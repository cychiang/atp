/**
 * @author <a href="mailto:soulinlove541@gmail.com">Henry Hung Yu Chen</a>
 * @version 1.0
 * @copyright Hung Yu Chen 2013
 */
var util = require('util');

/**
 * Create a new Logger which handles the standard input/output and all the log message generated at run-time.
 * @constructor
 */
function Logger() {
    var stdin = process.stdin,
        stdout = process.stdout,
        showTime = true;

    stdin.on('data', function (data) {
        var input = data.toString().trim();
        if (input) {
            switch (input) {
            case 'nodelist':
                db.nodeInfo.find().toArray(function (err,docs) {
                    var string = '';
                    for (var i = docs.length - 1; i >= 0; i--) {
                        string += docs[i]['id'] + ' ' + docs[i]['browser'] + ' ' + docs[i]['countryCode'] + '\n';
                    };
                    logger.print('Tester Number: '+docs.length);
                    logger.print(string);
                });
                break;
            case 'testlist':
                db.testList.find().toArray(function (err,docs) {
                    logger.print(docs);
                });
                break;
            case 'testresult':
                db.testResult.find().toArray(function (err,docs) {
                    logger.print(docs);
                });
                break;
            case 'showtime':
                showTime = ~showTime;
                break;
            case 'check':
                nodeManager.broadcast({
                    'event': 'check_connection'
                });
                break;
            case 'exit':
                nodeManager.broadcast({
                    'event': 'server_restart'
                });
                setTimeout(function(){
                   var d = new Date();
                   fs.appendFileSync('./log.txt', '['+d.toISOString().substring(0,10)+'-'+d.toTimeString().substring(0,8)+'] : Server Exit.\r\n===\r\n');
                   console.log('Server Exit');
                   process.exit(0);
               }, 5000);
                break;
            default:
                logger.print(input);
                break;
            }
        }
    });

    this.log = function() {
        if(typeof arguments['0'] == 'object') arguments['0'] = JSON.stringify(arguments['0']);
        if(showTime){
            var d = new Date();
            arguments['0'] = '['+d.toISOString().substring(0,10)+'-'+d.toTimeString().substring(0,8)+'] : '+arguments['0'];
        }
        console.log.apply(null,arguments);
        fs.appendFile('./log.txt', util.format.apply(this, arguments)+'\r\n', function (err) {
            if (err) throw err;
        });
    };

    this.print = function() {
        if(typeof arguments['0'] == 'object') arguments['0'] = JSON.stringify(arguments['0']);
        console.log.apply(null,arguments);
    };

    stdin.resume();
}

/**
 * Create a new Event Handler which manages self-defined events of server's web socket.
 * @constructor
 * @param   {Object} s  The server object.
 */
function EventHandler(s) {
    var events = {},
        server = s;

    this.on = function (eventName, callback) {
        events[eventName] = callback;
    };

    this.fire = function (eventName, _) {
        var evt = events[eventName],
            args = Array.prototype.slice.call(arguments, 1);

        if (!evt) { return; }
        evt.apply(server, args);
    };
}

/**
 * Create a new Node Manager which manages test nodes' infomation and status.
 * @constructor
 */
function NodeManager() {
    var self = this,
        socketList = {},
        nodeList = {},
        idList = [],
        idcounter = 0;

    this.init = function (count) {
        idcounter = count;
    };

    this.getNewId = function () {
        var id = idcounter;
        idcounter++;
        return id;
    };

    this.createNode = function (socket, id) {
        idList.push(id);
        socketList[id] = socket;
    };

    this.addNodeInfo = function (id,info) {
        nodeList[id] = info;
        db.nodeInfo.insert(info, function (err, inserted) {
            if (err) { logger.log('Mongodb: Error while collection.insert: ',err,inserted); }
        });
    };

    this.deleteNode = function (id) {
        idList.splice(idList.indexOf(id),1);
        delete socketList[id];
        nodeList[id] = null; //delete nodeList[id];
        db.nodeInfo.remove({'id': id}, {'single': 1}, function (err, numberOfRemovedDocs) {
            if (err) { logger.log('Mongodb: Error while collection.remove: ',err); }
        });
    };

    this.getIdList = function (selfId,test,directFunc,mixFunc) {
        var criteria = (test.conf.criteria)? test.conf.criteria:{},
            list = [];
        criteria.id = {'$ne':selfId};
        //criteria.bandwidth = {'$gt':5};
        criteria.browser = {'$ne': 'Firefox'};
        db.nodeInfo.find(criteria, {'_id': 0,'id': 1}, {'limit': test.conf.nodeNum}).toArray(function (err,docs) {
            if (err) {
                logger.log('Mongodb: Error while collection.find: ',err);
                return;
            }

            if(docs.length == test.conf.nodeNum) {
                for (var i = docs.length - 1; i >= 0; i--) {
                    list.push(docs[i]['id']);
                }
                directFunc(list,test,'direct');
            } else if(test.conf.allowMixMode == 'true') {
                var remainder = test.conf.nodeNum-docs.length;
                for (var i = docs.length - 1; i >= 0; i--) {
                    list.push(docs[i]['id']);
                }

                db.nodeInfo.find({'id': {'$nin': list, '$ne':selfId}}, {'_id': 0,'id': 1}, {'limit': remainder}).toArray(function (err,docs) {
                    if (err) {
                        logger.log('Mongodb: Error while collection.find: ',err);
                        return;
                    }

                    if(docs.length == remainder) {
                        var list2 = [];
                        for (var i = docs.length - 1; i >= 0; i--) {
                            list2.push(socketList[docs[i]['id']]);
                        }
                        mixFunc(list,list2,test);
                    } else {
                        errorManager.send(selfId,errorManager.INSUFFICIENT_TEST_NODE);
                    }
                });
            } else {
                errorManager.send(selfId,errorManager.INSUFFICIENT_TEST_NODE);
            }
        });
    };

    this.getSocket = function (id) {
        return socketList[id];
    };

    this.getSocketList = function (selfId,test,indirectFunc) {
        var criteria = (test.conf.criteria)? test.conf.criteria:{};
        criteria.id = {'$ne':selfId};
        //criteria.bandwidth = {'$gt':5};
        db.nodeInfo.find(criteria, {'_id': 0,'id': 1}, {'limit': test.conf.nodeNum}).toArray(function (err,docs) {
            if (err) {
                logger.log('Mongodb: Error while collection.find: ',err);
                return;
            }

            if(docs.length == test.conf.nodeNum) {
                var list = [];
                for (var i = docs.length - 1; i >= 0; i--) {
                    list.push(socketList[docs[i]['id']]);
                }
                indirectFunc(list,test);
            } else {
                errorManager.send(selfId,errorManager.INSUFFICIENT_TEST_NODE);
            }
        });
    };

    this.broadcast = function (msg) {
        for (var i = idList.length - 1; i >= 0; i--) {
            socketList[idList[i]].send(JSON.stringify(msg));
        };
    };
}

/**
 * Create a new Test Manager which manages tests with indirect mode requests.
 * @constructor
 */
function TestManager() {
    var testList = {},
        testId = 0;

    var generateTestId = function () {
        var ret = testId;
        testId++;
        return ret;
    };

    this.init = function (count) {
        testId = count;
    };

    this.addTest = function (t) {
        var tid = generateTestId(),
            test = t.getTest();

        test.info = {
            'tid': tid
        };
        testList[tid] = t;
        test.conf.criteria = JSON.stringify(test.conf.criteria);
        db.testList.insert(test, function (err, inserted) {
            if (err) { logger.log('Mongodb: Error while collection.insert(addTest): ',err,inserted); }
        });
    };

    this.getTest = function (id) {
        return testList[id];
    };
}

/**
 * Create a new Test.
 * @constructor
 * @param   {Number} id    Id of the test requester.
 * @param   {Object} test
 */
function Test(id,test) {
    var bucket = [],
        bucketCapacity = test.conf.nodeNum * test.conf.tpn * test.conf.loopCount * test.taskList.length;
        test = test,
        progress = 0;

    var latencyMin = 10000000,
        latencyMax = 0,
        rtMin = 10000000,
        rtMax = 0,
        ptMin = 10000000,
        ptMax = 0,
        dataSizeSum = 0;

    this.requesterId = id;

    this.putResult = function (result) {
        if(bucketCapacity == bucket.length) return true;
        if(result[1] < latencyMin) latencyMin = result[1];
        if(result[1] > latencyMax) latencyMax = result[1];
        if(result[2] < rtMin) rtMin = result[2];
        if(result[2] > rtMax) rtMax = result[2];
        if(result[2]-result[1] < ptMin) ptMin = result[2]-result[1];
        if(result[2]-result[1] > ptMax) ptMax = result[2]-result[1];
        dataSizeSum += result[4];
        bucket.push(result);

        if(bucketCapacity == bucket.length) {
            db.testResult.insert({
                    'requesterId': id,
                    'tid': test.info.tid,
                    'label': test.conf.label,
                    'result': bucket,
                    'aggregate': this.getAggregate()
                }, function (err, inserted) {
                if (err) { logger.log('Mongodb: Error while collection.insert(putResult): ',err,inserted); }
            });
        }

        if((bucket.length/bucketCapacity*100) - progress >= 20) {
            progress = Math.floor(bucket.length/bucketCapacity*10)*10;
            return progress;
        } else return 0;
    };

    this.getResult = function () {
        return bucket;
    };

    this.getAggregate = function () {
        return [ bucketCapacity, latencyMin, latencyMax, rtMin, rtMax, ptMin, ptMax, dataSizeSum ];
    }

    this.getTest = function () {
        return test;
    }
}

/**
 * Define detail of errors and handle the 'send' operation.
 * @constructor
 */
function ErrorManager () {
    this.INSUFFICIENT_TEST_NODE = {v: 0, n:'Insufficient test node'};

    this.send = function (id,error) {
        nodeManager.getSocket(id).send(JSON.stringify({
            'event': 'test_request_ack',
            'status': 'error',
            'errorCode': error
        }));
    };
}


/* HTTP Server */
var express = require('express');
    app = express(),
    fs = require('fs'),
    XMLHttpRequest = require('./xmlhttprequest2').XMLHttpRequest2;

/* CORS Support */
var enableCORS = function (req, res, next) {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Content-Length, X-Requested-With');

    // intercept OPTIONS method
    if ('OPTIONS' == req.method) {
        res.send(200);
    }
    else {
        next();
    }
};
//app.use(enableCORS);

app.use(express.json()); // to support JSON-encoded bodies
app.use(express.urlencoded()); // to support URL-encoded bodies

/* Websocket Server */
var WebSocketServer = require('ws').Server,
    server = new WebSocketServer({port: 9000}),
    eventHandler = new EventHandler(server);

/* Mongodb */
var ipaddr = process.env.MONGO_PORT_27017_TCP_ADDR
console.log("mongo ipaddr: %s", ipaddr);
var db,
    MongoClient = require('mongodb').MongoClient,
    mongoClient = new MongoClient(new require('mongodb').Server(ipaddr, 27017), {native_parser: true});

/* Testing Service */
var nodeManager = new NodeManager(), // for test node management
    testManager = new TestManager(), // for test and result management
    errorManager = new ErrorManager();

/* System log and console logger */
var logger = new Logger();
logger.log('Server started with port 8080');

process.on('exit', function() {
    //logger.log('Server exit.\n');
});

app.listen(8080);

app.post('/auth/login', function(req, res){
    db.userInfo.find({'email': req.body.email, 'password': req.body.password}, {'_id': 0,'selfId': 1}).toArray(function (err,docs) {
        if (err) {
            logger.log('Mongodb: Error while collection.find: ',err);
            return;
        }

        if(docs.length == 1) {
            res.send(' '+docs[0].selfId);
        } else {
            res.send('fail');
        }
    });
});

app.post('/auth/register', function(req, res){
    var data = req.body;
    data.selfId = nodeManager.getNewId();
    db.userInfo.insert(data, function (err, inserted) {
        if (err && err.code == 11000) { res.send('dup'); }
        else if (err) { logger.log('Mongodb: Error while collection.insert: ',err,inserted); res.send('fail'); }
        res.send('success');
    });
});

app.get('/', function (req, res) {
    res.sendfile(__dirname + '/index.html');
});

app.get(/^\/.*\.html\/?$/, function (req, res) {
    var path = __dirname + '/' + req._parsedUrl.pathname;
    fs.exists(path, function (exists) {
        if (!exists) {
            res.writeHead(404);
            return res.end('File not found')
        }
        res.sendfile(__dirname + '/' + req._parsedUrl.pathname);
    });
});

app.get('/serverdate.js', function(req, res){
    fs.readFile(__dirname+'/js/serverdate.js', 'utf8', function (err, data) {
        var now = Date.now();
        if (err)
            res.status(500);
        else {
            if (req.query.time) {
                res.set("Content-Type", "application/json");
                res.json(now);
            }
            else {
                res.set("Content-Type", "text/javascript");
                res.send(data + "(" + now + ");\n");
            }
        }
    });
});

app.get(/^\/.*\.js\/?$/, function (req, res) {
    var path = __dirname + '/js' + req._parsedUrl.pathname;
    fs.exists(path, function (exists) {
        if (!exists) {
            res.writeHead(404);
            return res.end('File not found')
        }
        res.sendfile(__dirname + '/js' + req._parsedUrl.pathname);
    });
});

app.get(/^\/.*\.css\/?$/, function (req, res) {
    var path = __dirname + '/css' + req._parsedUrl.pathname;
    fs.exists(path, function (exists) {
        if (!exists) {
            res.writeHead(404);
            return res.end('File not found')
        }
        res.sendfile(__dirname + '/css' + req._parsedUrl.pathname);
    });
});

app.get(/^\/fonts\/*\.*\//, function (req, res) {
    var path = __dirname + req._parsedUrl.pathname;
    fs.exists(path, function (exists) {
        if (!exists) {
            res.writeHead(404);
            return res.end('File not found')
        }
        res.sendfile(__dirname + req._parsedUrl.pathname);
    });
});

app.get(/^\/.*\.(png|gif|jpg|jpeg|JPG)\/?$/, function (req, res) {
    var path = __dirname + '/img' + req._parsedUrl.pathname;
    fs.exists(path, function (exists) {
        if (!exists) {
            res.writeHead(404);
            return res.end('File not found')
        }
        res.sendfile(__dirname + '/img' + req._parsedUrl.pathname);
    });
});

mongoClient.open(function (err,mongoClient) {
    db = mongoClient.db('atp');
    db.collection('NodeInfo', {w: 1}, function (err, collection) {
        if (err) { logger.log('Mongodb: Error while db.collection: ',err); }

        collection.remove(function (err, numberOfRemovedDocs) {
            if (err) { logger.log('Mongodb: Error while remove: ',err); }
        });

        db.nodeInfo = collection;
    });

    db.collection('TestList', {w: 1}, function (err, collection) {
        if (err) { logger.log('Mongodb: Error while db.collection: ',err); }
        collection.find().toArray(function (err,docs) {
            testManager.init(docs.length);
        });
        db.testList = collection;
    });

    db.collection('TestResult', {w: 1}, function (err, collection) {
        if (err) { logger.log('Mongodb: Error while db.collection: ',err); }
        db.testResult = collection;
    });

    db.collection('UserInfo', {w: 1}, function (err, collection) {
        if (err) { logger.log('Mongodb: Error while db.collection: ',err); }

        collection.ensureIndex({'email': 1}, {unique: true}, function (err, collection){
           if (err) { logger.log('Mongodb: Error while ensureIndex: ',err); }
        });
        collection.find().toArray(function (err,docs) {
            nodeManager.init(docs.length);
        });
        db.userInfo = collection;
    });
});

server.on('connection', function (socket) {
    var selfId,// = nodeManager.createNode(socket),
        checkAliveInterval = setInterval(function () {
            socket.send(JSON.stringify({
                'event': 'check_connection'
            }));
        }, 10*60*1000);

    // initialization
    socket.send(JSON.stringify({
        'event' : 'init',
    }));

    socket.on('message', function (message) {
    	var json = JSON.parse(message);
        if(json.event == 'node_info') {
            selfId = json.selfId;
            nodeManager.createNode(socket,selfId);
        }

    	logger.log('received event from ' + selfId + ': ' + json.event);
        eventHandler.fire(json.event,json,selfId);
    });

    socket.on('close', function (message) {
        logger.log('id (' + selfId + ') has disconnected');
        clearInterval(checkAliveInterval);
        nodeManager.deleteNode(selfId);
    });
});

/////////////
/// Events //
/////////////
eventHandler.on('node_info', function (json,id) {
    var info = {
        'id': id,
        'os': json.os,
        'browser': json.browser,
        'countryCode': json.countryCode,
        'bandwidth': parseInt(json.bandwidth)
    };
    logger.log('id (' + id + ') has connected: ' + info.browser+' '+info.countryCode);
    nodeManager.addNodeInfo(id,info);
});

eventHandler.on('send_offer', function (json,id) {
    nodeManager.getSocket(json.to).send(JSON.stringify({
        'event': 'receive_offer',
        'from': id,
        'sdp': json.sdp
    }));
});

eventHandler.on('send_answer', function (json,id) {
    nodeManager.getSocket(json.to).send(JSON.stringify({
        'event': 'receive_answer',
        'from': id,
        'sdp': json.sdp
    }));
});

eventHandler.on('send_ice_candidate', function (json,id) {
    nodeManager.getSocket(json.to).send(JSON.stringify({
        'event': 'receive_ice_candidate',
        'from': id,
        'candidate': json.candidate
    }));
});

eventHandler.on('test_request', function (json,id) {
    var conf = json.test.conf,
        indirectMode = function (list,test) {
            nodeManager.getSocket(id).send(JSON.stringify({
                'event': 'test_request_ack',
                'status': 'accept',
                'mode': 'indirect'
            }));
            testManager.addTest(new Test(id,test));
            for (var i = list.length - 1; i >= 0; i--) {
                list[i].send(JSON.stringify({
                    'event': 'test_assign',
                    'tid': test.info.tid,
                    'test': test
                }));
            }
        },
        directMode = function (list,test,mode) {
            nodeManager.getSocket(id).send(JSON.stringify({
                'event': 'test_request_ack',
                'status': 'accept',
                'mode': mode
            }));
            testManager.addTest(new Test(id,test));
            nodeManager.getSocket(id).send(JSON.stringify({
                'event': 'test_propagate',
                'nodeList': list,
                'tid': test.info.tid,
                'test': test // TODO in fact, no need to re-transmit task back to the user...
            }));
        },
        mixMode = function (list,list2,test) {
            nodeManager.getSocket(id).send(JSON.stringify({
                'event': 'test_request_ack',
                'status': 'accept',
                'mode': 'mix'
            }));
            testManager.addTest(new Test(id,test));

            nodeManager.getSocket(id).send(JSON.stringify({
                'event': 'test_propagate',
                'nodeList': list,
                'tid': test.info.tid,
                'test': test // TODO in fact, no need to re-transmit task back to the user...
            }));

            for (var i = list2.length - 1; i >= 0; i--) {
                list2[i].send(JSON.stringify({
                    'event': 'test_assign',
                    'tid': test.info.tid,
                    'test': test
                }));
            }
        };

    if (conf.mode == 'indirect') {
        nodeManager.getSocketList(id,json.test,indirectMode);
    } else if (conf.mode == 'direct') {
        nodeManager.getIdList(id,json.test,directMode,mixMode);
    }
});

eventHandler.on('test_result', function (json) {
    var test = testManager.getTest(json.tid);
    if(test.getTest().conf.mode == 'direct' && test.getTest().conf.allowMixMode == 'true') {
        nodeManager.getSocket(test.requesterId).send(JSON.stringify({
            'event': 'test_result',
            'tid': json.tid,
            'result': json.result
        }));
    } else if(test.getTest().conf.mode == 'indirect') {
        var progress = test.putResult(json.result);
        if (progress == 100) {
            nodeManager.getSocket(test.requesterId).send(JSON.stringify({
                'event': 'test_complete_notify',
                'testDetail': test.getTest()
            }));
        } else if(progress != 0) {
            nodeManager.getSocket(test.requesterId).send(JSON.stringify({
                'event': 'test_progress_notify',
                'percentage': progress
            }));
        }
    }
    test = null;
});

eventHandler.on('test_result_query', function (json,id) {
    var test = testManager.getTest(json.tid);
    if(test){
        nodeManager.getSocket(test.requesterId).send(JSON.stringify({
            'event': 'test_final_result',
            'tid': json.tid,
            'result': test.getResult(),
            'aggregate': test.getAggregate(),
            'testDetail': test.getTest()
        }));
        test = null;
    } else {
        db.testResult.find({'tid': parseInt(json.tid)}, {'_id': 0, 'result': 1, 'aggregate': 1}, {'limit': 1}).toArray(function (err,docs) {
            if (err) {
                logger.log('Mongodb: Error while collection.find: ',err);
                return;
            }
            db.testList.find({'info.tid': parseInt(json.tid)}, {'_id': 0}, {'limit': 1}).toArray(function (err,docs2) {
                nodeManager.getSocket(id).send(JSON.stringify({
                    'event': 'test_final_result',
                    'tid': json.tid,
                    'result': docs[0].result,
                    'aggregate': docs[0].aggregate,
                    'testDetail': docs2[0]
                }));
            });
        });
    }
});

eventHandler.on('test_result_list_query', function (json) {
    db.testResult.find({'requesterId': json.id}, {'_id': 0,'tid': 1,'label': 1}, {'limit': 5}).toArray(function (err,docs) {
        if (err) {
            logger.log('Mongodb: Error while collection.find: ',err);
            return;
        }
        var list = [];
        for (var i = docs.length - 1; i >= 0; i--) {
            list.push(docs[i]);
        }

        nodeManager.getSocket(json.id).send(JSON.stringify({
            'event': 'test_result_list',
            'list': list
        }));
    });
});

eventHandler.on('check_connection_ack', function (json) {

});
