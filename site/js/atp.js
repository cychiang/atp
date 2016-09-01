/**
 * @author <a href="mailto:soulinlove541@gmail.com">Henry Hung Yu Chen</a>
 * @version 1.0
 * @copyright Hung Yu Chen 2013
 */

/**
 * Create a new TestHandler which do the test task.
 * @constructor
 * @param   {Number}  testId  The test id of the given test.
 * @param   {Object}  t       Test object which composed of test configuration and task detail.
 */
function TestHandler(testId,t) {
    var self = this,
        conf = t.conf,
        taskList = t.taskList,
        workers = [],
        iterCount = 1,
        completeWorkerCount = 0;

    function runTest () {
        workers = [];
        completeWorkerCount = 0;
        for (var i = conf.tpn - 1; i >= 0; i--) {
            var worker = new Worker('testhandler.js');
            worker.addEventListener('message', function (e) {
                if(e.data.event == 'result'){
                    console.log('TestHandler: ' + JSON.stringify(e.data.result));
                    e.data.result.push(BrowserInfo.countryCode);
                    e.data.result.push(BrowserInfo.browser);
                    self.rc.send(JSON.stringify({
                        'event': 'test_result',
                        'tid': testId,
                        'result': e.data.result
                    }));
                } else if(e.data.event == 'finish'){
                    completeWorkerCount++;
                }

                if(workers.length == completeWorkerCount && iterCount != conf.loopCount) {
                    iterCount++;
                    runTest();
                } else if(workers.length == completeWorkerCount && iterCount == conf.loopCount) {
                    this.terminate();
                }
            }, false);
            workers.push(worker);
        };

        for (var j = conf.tpn - 1; j >= 0; j--) {
            setTimeout(function (index) {
                workers[index].postMessage({'cmd': 'start', 'taskList': taskList, 'timer': conf.timer, 'timeOffset': ServerDate.getOffset()});
            }, Math.random()*1000*conf.activatePeriod, j);
        };
    }

    function designatedTimer (designatedTime) {
        if (designatedTime.getTime() <= new Date().getTime()) {
            console.log('TestHandler: Test start');
            runTest();
            return;
        }
        setTimeout(arguments.callee,1000,designatedTime);
    }

    this.testStart = function (rc) { // report channel
        self.rc = rc;
        designatedTimer(new Date(conf.startTime));
    };
}

/**
 * Create a new Test Manager which manages tests with indirect mode requests.
 * @constructor
 */
function TestManager() {
    var testList = {};

    this.addTest = function (t) {
        testList[t.getTest().info.tid] = t;
    };

    this.getTest = function (tid) {
        return testList[tid];
    };
}

/**
 * Create a new TestManager which manages tests in direct mode.
 * @constructor
 * @param   {Object}  t  Test object which composed of test configuration and task detail.
 * @param   {Array}   l  Array which contains test nodes information given by ATP server.
 */
function Test(t,l) {
    var bucket = [],
        bucketCapacity = t.conf.nodeNum * t.conf.tpn * t.conf.loopCount * t.taskList.length,
        test = t;

    var latencyMin = 10000000,
        latencyMax = 0,
        latencySum = 0,
        rtMin = 10000000,
        rtMax = 0,
        rtSum = 0,
        ptMin = 10000000,
        ptMax = 0,
        ptSum = 0,
        dataSizeSum = 0;

    this.nodeList = l;

    this.putResult = function (result) {
        if(result[1] < latencyMin) latencyMin = result[1];
        if(result[1] > latencyMax) latencyMax = result[1];
        if(result[2] < rtMin) rtMin = result[2];
        if(result[2] > rtMax) rtMax = result[2];
        if(result[2]-result[1] < ptMin) ptMin = result[2]-result[1];
        if(result[2]-result[1] > ptMax) ptMax = result[2]-result[1];
        latencySum += result[1];
        rtSum += result[2];
        ptSum += (result[2]-result[1]);
        dataSizeSum += result[4];
        bucket.push(result);
        return (bucketCapacity == bucket.length);
    };

    this.getResult = function () {
        return bucket;
    };

    this.getAggregate = function () {
        return [ bucketCapacity, latencyMin, latencyMax, latencySum/bucket.length, rtMin, rtMax, rtSum/bucket.length, ptMin, ptMax, ptSum/bucket.length, dataSizeSum ];
    }

    this.getTest = function () {
        return test;
    }
}

/**
 * Create a new RTCManager which manages webrtc peer connections and data channels.
 * @constructor
 */
function RTCManager() {
    var rtcList = {};

    this.addRTC = function (id,rtc) {
        rtcList[id] = rtc;
    };

    this.updateRTC = function (id,npc,ndc) {
        if(rtcList[id]){
            if(npc) rtcList[id].pc = npc;
            if(ndc) rtcList[id].dc = ndc;
        }
    }

    this.removeRTC = function (id) {
        rtcList[id] = null;
    };

    this.clearRTC = function () {
        rtcList = {};
    };

    this.getPC = function (id) {
        if(rtcList[id]) { return rtcList[id].pc; }
        else { return null; }
    };

    this.getDC = function (id) {
        if(rtcList[id]) { return rtcList[id].dc; }
        else { return null; }
    };
}

/**
 * Create a new ATP instance.
 * @constructor
 */
function Atp() {
    var atp = this,
        ws,
        selfId,
        testManager = new TestManager(),
        currentTest, // for test host
        testHandler, // for test node
        rtcManager = new RTCManager(), // for rtc peerconnection and datachannel
        RTC = null;

        if(navigator.webkitGetUserMedia) {
            RTC = RTCForChrome;
            RTCSessionDescription = window.RTCSessionDescription;
            RTCIceCandidate = window.RTCIceCandidate;
        } else if(navigator.mozGetUserMedia) {
            RTC = RTCForFirefox;
            RTCSessionDescription = mozRTCSessionDescription,
            RTCIceCandidate = mozRTCIceCandidate;
        }

    /**
     * Initialize the service. Detect the test node information and bandwidth.
     */
    (function () {
        BrowserInfo.init();

        var startTime, endTime, duration, speedMbps;
            downloadSize = 2977815 * 8, // bits
            testImg = new Image();

        testImg.onload = function () {
            endTime = (new Date()).getTime();
            duration = (endTime - startTime) / 1000,
            BrowserInfo.bandwidth = (downloadSize / (duration * 1024 * 1024)).toFixed(2); // Mbps

            if (navigator.geolocation) {
                navigator.geolocation.getCurrentPosition(function (position) {
                    BrowserInfo.lat = position.coords.latitude;
                    BrowserInfo.lng = position.coords.longitude;
                    var xhr = new XMLHttpRequest;
                    xhr.onreadystatechange = function () {
                        if (xhr.readyState == 4 && xhr.status == 200) {
                            BrowserInfo.countryCode = xhr.responseText.trim();
                            if(BrowserInfo.countryCode == 'TW' && (codehelper_ip.CityName=='Hsinchu'||codehelper_ip.CityName=='Taipei'||codehelper_ip.CityName=='Kaohsiung'||codehelper_ip.CityName=='Keelung')) BrowserInfo.countryCode = codehelper_ip.CityName;
                            xhr = null;
                            startService();
                        }
                    };
                    xhr.open('GET', 'http://api.geonames.org/countryCode'+'?lat='+BrowserInfo.lat+'&lng='+BrowserInfo.lng+'&username=hungyuc', true);
                    xhr.send();
                }, function (error) {
                    console.log('Geo error: '+error.code);
                    /*switch (error.code) {
                    case error.PERMISSION_DENIED: alert("Please share your geolocation data.\nPlease refresh this page.");
                        break;
                    case error.POSITION_UNAVAILABLE: alert("Unable to detect current position.\nPlease refresh this page.");
                        break;
                    case error.TIMEOUT: alert("Timeout.\nPlease refresh this page.");
                        break;
                    default: alert("Unknown error.\nPlease refresh this page.");
                        break;
                    }*/

                    ///
                    BrowserInfo.lat = codehelper_ip.CityLatitude;
                    BrowserInfo.lng = codehelper_ip.CityLongitude;
                    BrowserInfo.countryCode = codehelper_ip.Country;
                    if(BrowserInfo.countryCode == 'TW' && (codehelper_ip.CityName=='Hsinchu'||codehelper_ip.CityName=='Taipei'||codehelper_ip.CityName=='Kaohsiung'||codehelper_ip.CityName=='Keelung')) BrowserInfo.countryCode = codehelper_ip.CityName;
                    startService();
                    ///

                }, { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 });
            } else {
                BrowserInfo.lat = -1;
                BrowserInfo.lng = -1;
                BrowserInfo.countryCode = 'unknown';
            }
        }

        startTime = (new Date()).getTime();
        testImg.src = 'speedtest.png?rnd=' + Math.random();
    })();

    function startService() {
        console.log('[ATP] Service has been startted.');
        ws = new WebSocket('ws://localhost:9000/');

        ws.onopen = function () {
            console.log('ws: server connected');
        };

        ws.onmessage = function (message) {
            var json = JSON.parse(message.data);
            console.log('ws: received event: ' + json.event);

            switch (json.event) {
            case 'init':
                selfId = sessionStorage.getItem('selfId');

                ws.send(JSON.stringify({
                    'event': 'node_info',
                    'os': BrowserInfo.os,
                    'browser': BrowserInfo.browser,
                    'lat': BrowserInfo.lat,
                    'lng': BrowserInfo.lng,
                    'countryCode': BrowserInfo.countryCode,
                    'bandwidth': BrowserInfo.bandwidth,
                    'selfId': selfId
                }));

                ws.send(JSON.stringify({
                    'event': 'test_result_list_query',
                    'id': selfId
                }));
                break;
            case 'receive_offer':
                rtcManager.addRTC(json.from,RTC('answerer',json,json.from));
                break;
            case 'receive_answer': // only offerer can receive this event
                rtcManager.getPC(json.from).setRemoteDescription(new RTCSessionDescription(json.sdp));
                break;
            case 'receive_ice_candidate':
                var candidate = new RTCIceCandidate(json.candidate);
                rtcManager.getPC(json.from) && rtcManager.getPC(json.from).addIceCandidate(candidate);
                break;
            case 'test_assign':
                testHandler = new TestHandler(json.tid,json.test);
                testHandler.testStart(ws);
                break;
            case 'test_complete_notify':
                atp.notifyUI('test_complete',json.testDetail);
                break;
            case 'test_propagate':
                currentTest = new Test(json.test,json.nodeList);
                testManager.addTest(currentTest);
                if(json.nodeList.length > 0) { createMultipleRTC(); }
                break;
            case 'test_result':
                if (currentTest.putResult(json.result)) {
                    atp.notifyUI('test_complete',currentTest.getTest().tid,currentTest.getTest().conf.label);
                }
                break;
            case 'test_final_result':
                atp.notifyUI('show_result',json.tid,json.result,json.aggregate,json.testDetail);
                break;
            case 'test_request_ack':
                if(json.status == 'accept') {
                    atp.notifyUI('req_accept',json.mode);
                } else if(json.status == 'error') {
                    atp.notifyUI('req_error',json.errorCode.n);
                }
                break;
            case 'test_result_list':
                atp.notifyUI('test_result_list',json.list);
                break;
            case 'server_restart':
                setTimeout(function(){
                    window.location.reload();
                }, 15000+Math.random()*5000);
                break;
            case 'check_connection':
                ws.send(JSON.stringify({
                    'event': 'check_connection_ack'
                }));
                break;
            case 'test_progress_notify':
                break;
            }
        };

        ws.onerror = function (err) {
            console.log('ws: error: ' + err);
        };

        ws.onclose = function (data) {
            console.log('ws: server disconnected');
            if(atp) atp.stopService();
        };

        atp.notifyUI('ready');
    }

    /**
     * Create multiple webrtc connections. This function can only be called by an offerer-role node.
     */
    function createMultipleRTC() {
        for (var i = currentTest.nodeList.length - 1; i >= 0; i--) {
            rtcManager.addRTC(currentTest.nodeList[i],RTC('offerer','',currentTest.nodeList[i]));
        }
    }

    /**
     * Create a new RTC for Chrome.
     * @constructor
     * @param   {String}  role      The role(offerer or answerer) of this node.
     * @param   {Object}  json      Json object which contains the session description string.
     * @param   {Number}  targetid  The id of the opposite side.
     * @return  {Object}  An object contains peer connection and data channel.
     */
    function RTCForChrome(role, json, targetid) {
        var iceServers = {
                iceServers: [{
                    url: 'stun:stun.l.google.com:19302'
                }]
            },
            optionalRtpDataChannels = {
                optional: [{
                    RtpDataChannels: true
                }]
            },
            mediaConstraints = {
                optional: [],
                mandatory: {
                    OfferToReceiveAudio: false,
                    OfferToReceiveVideo: false
                }
            },
            rtcPeerConnection = new webkitRTCPeerConnection(iceServers, optionalRtpDataChannels),
            rtcDataChannel = rtcPeerConnection.createDataChannel('RTCDataChannel', {});

        if(role == 'answerer') {
            offerSDP = new RTCSessionDescription(json.sdp);
            rtcPeerConnection.setRemoteDescription(offerSDP);
            rtcPeerConnection.createAnswer(function (sessionDescription) {
                rtcPeerConnection.setLocalDescription(sessionDescription);
                ws.send(JSON.stringify({
                    'event': 'send_answer',
                    'to': json.from,
                    'sdp': sessionDescription
                }));
            }, null, mediaConstraints);
        } else {
            rtcPeerConnection.createOffer(function (sessionDescription) {
                rtcPeerConnection.setLocalDescription(sessionDescription);
                ws.send(JSON.stringify({
                    'event': 'send_offer',
                    'to': targetid,
                    'sdp': sessionDescription
                }));
            }, null, mediaConstraints);
        }

        rtcPeerConnection.onicecandidate = function (event) {
            if (!event || !event.candidate) { return; }
            console.log('rtc: onicecandidate');
            ws.send(JSON.stringify({
                'event': 'send_ice_candidate',
                'to': targetid,
                'candidate': event.candidate
            }));
            this.onicecandidate = null;
        };

        rtcPeerConnection.ondatachannel = function (event) {
            console.log('rtc: data channel is connecting...');
        };

        rtcDataChannel.onopen = function () {
            console.log('rtc: data channel has opened');
            if(role == 'offerer') { // only test manager can be offerer, not test client
                this.send(JSON.stringify({
                    'event': 'test_assign',
                    'test': currentTest.getTest()
                }));
            }
        };

        rtcDataChannel.onclose = function () { // seems to be useless
            console.log('rtc: data channel has closed');
            this.send(selfId + ' has leaved the chat');
        };

        rtcDataChannel.onmessage = function (event) {
            var json = JSON.parse(event.data);
            console.log('rtc: receive message: '+json.event);

            if(json.event == 'test_assign') {
                testHandler = new TestHandler('',json.test);
                testHandler.testStart(this);
            } else if(json.event == 'test_result') {
                if (currentTest.putResult(json.result)) {
                    atp.notifyUI('test_complete',currentTest.getTest());
                }
            } else if(json.event == 'node_leaving') {
                rtcManager.removeRTC(json.nodeId);
                currentTest.nodeList.splice(currentTest.nodeList.indexOf(json.nodeId),1);
            }
        };

        return {
            'pc': rtcPeerConnection,
            'dc': rtcDataChannel
        };
    }

    /**
     * Create a new RTC for Firefox
     * @constructor
     * @param   {String}  role     The role(offerer or answerer) of this node.
     * @param   {Object}  json     Json object which contains the session description string.
     * @param   {Number}  targetid The id of the opposite side.
     * @return  {Object}  An object contains peer connection and data channel.
     */
    function RTCForFirefox(role, json, targetid) {
        var iceServers = {
                iceServers: [{
                    url: 'stun:23.21.150.121'
                }]
            },
            mediaConstraints = {
                optional: [],
                mandatory: {
                    OfferToReceiveAudio: false,
                    OfferToReceiveVideo: false
                }
            },
            rtcPeerConnection = new mozRTCPeerConnection(iceServers),
            rtcDataChannel;

        if(role == 'answerer') {
            offerSDP = new mozRTCSessionDescription(json.sdp);
            rtcPeerConnection.setRemoteDescription(offerSDP);
            rtcPeerConnection.createAnswer(function (sessionDescription) {
                rtcPeerConnection.setLocalDescription(sessionDescription);
                ws.send(JSON.stringify({
                    'event': 'send_answer',
                    'to': json.from,
                    'sdp': sessionDescription
                }));
            }, useless, mediaConstraints);

        } else {
            rtcDataChannel = rtcPeerConnection.createDataChannel('RTCDataChannel', {});
            //rtcDataChannel.binaryType = 'blob';
            rtcPeerConnection.createOffer(function (sessionDescription) {
                rtcPeerConnection.setLocalDescription(sessionDescription);
                ws.send(JSON.stringify({
                    'event': 'send_offer',
                    'to': targetid,
                    'sdp': sessionDescription
                }));
            }, useless, mediaConstraints);

            setupRTCDataChannel();
        }

        rtcPeerConnection.onicecandidate = function (event) {
            console.log('rtc: onicecandidate');
        };

        rtcPeerConnection.ondatachannel = function (event) {
            console.log('rtc: data channel is connecting...');
            if(role == 'answerer'){
                rtcDataChannel = event.channel;
                //rtcDataChannel.binaryType = 'blob';
                rtcManager.updateRTC(targetid,null,rtcDataChannel);
                setupRTCDataChannel();
            }
        };

        function setupRTCDataChannel(){
            rtcDataChannel.onopen = function () {
                console.log('rtc: data channel has opened');
                if(role == 'offerer') { // only test manager can be offerer, not test client
                    this.send(JSON.stringify({
                        'event': 'test_assign',
                        'test': currentTest.getTest()
                    }));
                }
            };

            rtcDataChannel.onclose = function () { // seems to be useless
                console.log('rtc: data channel has closed');
                this.send(selfId + ' has leaved the chat');
            };

            rtcDataChannel.onmessage = function (event) {
                var json = JSON.parse(event.data);
                console.log('rtc: receive message: '+json.event);

                if(json.event == 'test_assign') {
                    testHandler = new TestHandler('',json.test);
                    testHandler.testStart(this);
                } else if(json.event == 'test_result') {
                    if (currentTest.putResult(json.result)) {
                        atp.notifyUI('test_complete',currentTest.getTest());
                    }
                } else if(json.event == 'node_leaving') {
                    rtcManager.removeRTC(json.nodeId);
                    currentTest.nodeList.splice(currentTest.nodeList.indexOf(json.nodeId),1);
                }
            };
        }

        function useless() {}

        return {
            'pc': rtcPeerConnection,
            'dc': rtcDataChannel
        };
    }

    this.stopService = function () {
        console.log('[ATP] Service has been stopped.');
        ServerDate.stop();
        ws.close();
        ws = null;
        selfId = null;
        delete currentTest;
        delete testHandler;
        delete rtcManager;

        $('#service-status').text('Offline').removeClass('btn-danger');
    };

    this.queryTestResult = function (li,isDirectMode) {
        if(li.className == 'active' || li.id == 'x') return;
        if(!isDirectMode){
            ws.send(JSON.stringify({
                'event': 'test_result_query',
                'tid': li.id
            }));
        } else {
            var t = testManager.getTest(li.id);
            atp.notifyUI('show_result',t.getTest().info.tid,t.getResult(),t.getAggregate(),t.getTest());
        }
    };

    this.sendTestRequest = function (req) {
        ws.send(JSON.stringify(req));
    };

    this.getSelfId = function () {
        return selfId;
    };

    this.notifyUI = function () {};

    /**
     * Listen to the page refresh and close event.
     * @param   {Object}  e Event.
     */
    window.addEventListener('unload',function (e) {
        testHandler.rc.send(JSON.stringify({
            'event': 'node_leaving',
            'nodeId': selfId
        }));
    });
}
