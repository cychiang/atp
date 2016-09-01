function Statistic (arr,index) {
    var s = {mean: 0, variance: 0, deviation: 0},
        arrSize = arr.length,
        sum = 0;
    for (var i = arr.length - 1; i >= 0; i--) {
        sum += arr[i][index];
    };
    s.mean = sum / arrSize;
    sum = 0;
    for (var i = arr.length - 1; i >= 0; i--) {
        sum += Math.pow(arr[i][index] - s.mean, 2);
    };
    s.variance = sum / arrSize;
    s.deviation = Math.sqrt(s.variance);
    return s;
}

function AtpUI () {
    var aggregateTable,
        latencyScatterChart,
        responseTimeScatterChart,
        processingTimeScatterChart,
        nodeDistributionChart,
        nodeDistributionTable,
        resultTable,
        currentResult,
        aggregateTableOptions = {
            showRowNumber: true
        };

    (function () {
        $('a[data-toggle="tab"]').on('shown.bs.tab', function (e) {
            location.hash = $(e.target).attr('href');
            sessionStorage.setItem('currentTab', $(e.target).attr('href'));
        });

        $('.navbar-brand').click(function (e) {
            $('div.navbar-collapse li.active').removeClass('active');
        });

        $('[href="#Dashboard"]').click(function (e) {
            $('#unread-result')[0].textContent = '';
        });
    })();

    this.login = function () {
        $('div.navbar-collapse li.hidden').removeClass('hidden');
        $('[onclick="logout();"]').parent().removeClass('active');
        $('[data-target="#loginModal"]').parent().addClass('hidden');
    };

    this.logout = function () {
        $('div.navbar-collapse li:not(:has([href="#About"]))').addClass('hidden');
        $('[data-target="#loginModal"]').parent().removeClass('hidden');
        $('div.navbar-collapse li.active').removeClass('active');
        if($('#unread-result')[0]) $('#unread-result')[0].textContent = '';

        if(sessionStorage.getItem('role') == 'tester') {
            $('#dashboard-list').empty().append('<li class="dropdown-header"><h4><span class="glyphicon glyphicon-list"></span> Dashboard</h4></li>');
            $('#test-result').children('div>div').addClass('hidden').children('div').empty();
        }
    };

    this.addTask = function ($list) {
        $list.parent().parent().append(
            '<div style="display: none;"><hr><div class="row vertical-container">' +
            '<div class="col-md-1"><button type="button" class="btn btn-danger" onclick="atpUI.removeTask($(this));"><span class="glyphicon glyphicon-remove-circle"></span></button></div>' +
            '<div class="col-md-11"><label for="http-req-task-url">Url <input type="text" id="http-req-task-url" class="form-control" style="min-width: 300px;" value="http://updates.html5rocks.com"></label><br>' +
            '<label for="http-req-task-method" >HTTP Method <select id="http-req-task-method" class="form-control"><option value="GET" selected="selected">GET</option><option value="POST">POST</option></select></label>' +
            '<label for="http-req-task-path">Path <input type="text" id="http-req-task-path" class="form-control" value="/"></label>'+
            '<label for="http-req-task-args">Args <input type="text" id="http-req-task-args" class="form-control" value=""></label></div></div></div>'
        ).children(':last').fadeIn();
    };

    this.removeTask = function ($task) {
        $task.parent().parent().parent().fadeOut('slow', function(){
            $(this).remove();
        });
    };

    this.toggleMixModeVisibility = function (id) {
        $('#'+id).parent().toggleClass('hidden');
        $('[value="IE"]').parent().parent().toggleClass('hidden');
        $('[value="Firefox"]').parent().parent().toggleClass('hidden');
    };

    this.processNotification = function () {
        var text;
        if(arguments[0] == 'req_accept') {
            text = (arguments[1] == 'indirect')? '<li id="x" onclick="atp.queryTestResult(this,false);">' : '<li id="x" onclick="atp.queryTestResult(this,true);">';
            $('.nav.bs-sidenav').append(text +
                '<a href="#test-result"><img src="progressing.gif"> Test Running...</img></a><ul class="nav">' +
                '<li class="dropdown-header">HTTP Request Test</li>' +
                '<li><a href="#test-detail-list-div">Test Detail</a></li>' +
                '<li><a href="#latency-chart-div">Latency</a></li>' +
                '<li><a href="#response-time-chart-div">Response Time</a></li>' +
                '<li><a href="#processing-time-chart-div">Processing Time</a></li>' +
                '<li><a href="#test-node-distribution-div">Test Node Distribution</a></li>' +
                '<li><a href="#result-table-div">Result Table</a></li></ul></li>');
            $('[href=#Dashboard]').trigger('click');
        } else if(arguments[0] == 'test_complete') {
            notifyTestComplete(arguments[1]);
        } else if(arguments[0] == 'show_result') {
            showResult(arguments[1],arguments[2],arguments[3],arguments[4]);
        } else if(arguments[0] == 'req_error') {
            $('#errorModal .modal-body')[0].innerHTML = '<p>We apology for the situation of</p>' + 
                '<p><strong>' + arguments[1] + '</strong></p>' +
                'Please try again later.';
            $('#errorModal').modal('show');
        } else if(arguments[0] == 'ready') {
            $('button.disabled').removeClass('disabled');
        } else if(arguments[0] == 'test_result_list') {

            for (var i = arguments[1].length - 1; i >= 0; i--) {
                $('.nav.bs-sidenav').append('<li id="' + arguments[1][i]['tid'] + '" onclick="atp.queryTestResult(this,false);">' +
                    '<a href="#test-result">' + arguments[1][i]['label'] + ' [' + arguments[1][i]['tid'] + ']</a><ul class="nav">' +
                    '<li class="dropdown-header">HTTP Request Test</li>' +
                    '<li><a href="#test-detail-list-div">Test Detail</a></li>' +
                    '<li><a href="#latency-chart-div">Latency</a></li>' +
                    '<li><a href="#response-time-chart-div">Response Time</a></li>' +
                    '<li><a href="#processing-time-chart-div">Processing Time</a></li>' +
                    '<li><a href="#test-node-distribution-div">Test Node Distribution</a></li>' +
                    '<li><a href="#result-table-div">Result Table</a></li></ul></li>');
            };
        }
    };

    this.parseCriteria = function (items) {
        if(items.length === 0) { return; }
        var criteria = [],
            i = items.length-1,
            type = ['countryCode','browser'];
        
        for(var typeIdx=0;typeIdx<2;typeIdx++) {
            if(i>=0 && items[i].id == type[typeIdx]) {
                var tmpArr = [];
                for(;i>=0;i--) {
                    if(items[i].id != type[typeIdx]) { break; }
                    var tmp = {};
                    tmp[items[i].id] = items[i].value;
                    tmpArr.push(tmp);
                }
                criteria.push({"$or":tmpArr});
            }
        }
        return {'$and': criteria};
    };

    this.parseTaskList = function (list) {
        var taskList = [],
            urlList = $(list+' #http-req-task-url'),
            methodList = $(list+' #http-req-task-method'),
            pathList = $(list+' #http-req-task-path'),
            argsList = $(list+' #http-req-task-args');

        for (var i = 0; i < urlList.length ; i++) {
            var task = {};
            task.url = urlList[i].value;
            task.method = methodList[i].value;
            task.path = pathList[i].value;
            task.args = argsList[i].value;
            taskList.push(task);
        };

        return taskList;
    };

    this.exportToCSV = function () {

        if(currentResult == null) {
            alert('No available test result.');
            return;
        }

        var colDelim = '","',
            rowDelim = '"\r\n"',
            csv = '"Time","Latency (ms)","Response Time (ms)","Processing Time (ms)","Status Code","Size (byte)","Country Code","Browser' + rowDelim;
        
        for (var i = 0; i < currentResult.length; i++) {
            var j = 0;
            for(; j < 3;j++) {
                csv += currentResult[i][j] + colDelim;
            }
            csv += (currentResult[i][2]-currentResult[i][1]) + colDelim;
            for(; j < 6;j++) {
                csv += currentResult[i][j] + colDelim;
            }
            csv += currentResult[i][6] + rowDelim;
        };

        $(this).attr({
            'download': 'result.csv',
            'href': 'data:application/csv;charset=utf-8,' + encodeURIComponent(csv),
            'target': '_blank'
        });
    };

    function notifyTestComplete (test) {
        var t = $('#unread-result')[0].textContent,
            tid = test.info.tid;

        if(sessionStorage.getItem('currentTab') != '#Dashboard') {
            $('#unread-result')[0].textContent = (t == '')? 1:Math.round(t)+1;
        }

        $('#x [href="#test-result"]')[0].innerHTML = test.conf.label + ' [' + tid + '] <span class="glyphicon glyphicon-expand"></span>';
        $('#x')[0].id = tid;
    }

    function showResult (tid,result,aggregate,testDetail) {
        var li = document.getElementById(testDetail.info.tid);
        if(li.className == 'active') return;
        $('.bs-sidenav li.active').removeClass('active');
        li.className = 'active';

        $('#test-result .hidden').removeClass('hidden');

        currentResult = result.slice(0);
        currentResult.sort(function(x,y){
            if(x[0] < y[0]) return -1;
            else if(x[0] > y[0]) return 1;
            return 0;
        });

        showTestDetail(testDetail);
        drawLatencyScatterChart(currentResult,aggregate);
        drawResponseTimeScatterChart(currentResult,aggregate);
        drawProcessingTimeScatterChart(currentResult,aggregate);
        drawTestNodeDistribution(currentResult);
        drawResultTable(currentResult);
    }

    function showTestDetail (testDetail) {
        var taskListString = '';
        $('#test-detail-list-div #mode').text(testDetail.conf.mode);
        $('#test-detail-list-div #node-number').text(testDetail.conf.nodeNum);
        $('#test-detail-list-div #loop-count').text(testDetail.conf.loopCount);
        $('#test-detail-list-div #delay').text(testDetail.conf.timer.delayBase + ' / ' + testDetail.conf.timer.delayOffset);
        if(testDetail.conf.criteria) $('#test-detail-list-div #node-requirement').text(testDetail.conf.criteria.replace(/"|\{|\}|\[|\]|\$|and|or|countryCode|browser|id|ne|:|[0-9]*/g,'').replace(/,/g,' '));
        else $('#test-detail-list-div #node-requirement').text('');
        
        for (var i = 0; i < testDetail.taskList.length; i++) {
            taskListString += '<span class="label label-info">' + testDetail.taskList[i].method + '</span>  ' + testDetail.taskList[i].url + testDetail.taskList[i].path + '<br>';
        };
        $('#test-detail-list-div #task-list').html(taskListString);
    }

    function drawLatencyScatterChart (result,aggregate) {
        var array = [],
            data = new google.visualization.DataTable(),
            options = {
                chartArea: {top: 20, left: 60, width: '100%'},
                height: 500,
                hAxis: {title: 'Time elapsed since first test (ms)'},
                vAxis: {title: 'Latency (ms)'},
                pointSize: 4,
                legend: {position: 'none'},
                explorer: { actions: ['dragToZoom', 'rightClickToReset'] },
                trendlines: {
                    0: { color: 'green', type: 'exponential', pointSize: 0, opacity: 0.5}
                }
            };

        for (var i = result.length - 1; i >= 0; i--) {
            var time = new Date(result[i][0]);
            array.push( [result[i][0]-result[0][0], result[i][1], time.toTimeString().substring(0,8)+':'+time.getMilliseconds()+' -> '+result[i][1]+'ms'] );
        };

        data.addColumn('number', 'Time-point of receiving first byte');
        data.addColumn('number', 'Latency (ms)');
        data.addColumn({type: 'string', role: 'tooltip'});
        data.addRows(array);

        latencyScatterChart = new google.visualization.ScatterChart(document.getElementById('latency-scatter'));
        latencyScatterChart.draw(data, options);

        var aggregateData = new google.visualization.DataTable(),
            statistic = Statistic(array,1);
        aggregateData.addColumn('number', 'Min (ms)');
        aggregateData.addColumn('number', 'Max (ms)');
        aggregateData.addColumn('number', 'Average (ms)');
        aggregateData.addColumn('number', 'Standard Deviation (ms)');
        aggregateData.addRows([[aggregate[1],aggregate[2],statistic.mean,statistic.deviation]]);
        aggregateTable = new google.visualization.Table(document.getElementById('latency-aggregate-table'));
        aggregateTable.draw(aggregateData);
    }

    function drawResponseTimeScatterChart (result,aggregate) {
        var array = [],
            data = new google.visualization.DataTable(),
            options = {
                chartArea: {top: 20, left: 60, width: '100%'},
                height: 500,
                hAxis: {title: 'Time elapsed since first test (ms)'},
                vAxis: {title: 'Response Time (ms)'},
                pointSize: 4,
                legend: {position: 'none'},
                explorer: { actions: ['dragToZoom', 'rightClickToReset'] },
                trendlines: {
                    0: { color: 'green', type: 'exponential', pointSize: 0, opacity: 0.5, tooltip:'none'}
                }
            };

        for (var i = result.length - 1; i >= 0; i--) {
            var time = new Date(result[i][0]);
            array.push( [result[i][0]-result[0][0], result[i][2], time.toTimeString().substring(0,8)+':'+time.getMilliseconds()+' -> '+result[i][2]+'ms'] );
        };

        data.addColumn('number', 'Time-point of receiving first byte');
        data.addColumn('number', 'Response Time (ms)');
        data.addColumn({type: 'string', role: 'tooltip'});
        data.addRows(array);

        responseTimeScatterChart = new google.visualization.ScatterChart(document.getElementById('response-time-scatter'));
        responseTimeScatterChart.draw(data, options);

        var aggregateData = new google.visualization.DataTable(),
            statistic = Statistic(array,1);
        aggregateData.addColumn('number', 'Min (ms)');
        aggregateData.addColumn('number', 'Max (ms)');
        aggregateData.addColumn('number', 'Average (ms)');
        aggregateData.addColumn('number', 'Standard Deviation (ms)');
        aggregateData.addRows([[aggregate[3],aggregate[4],statistic.mean,statistic.deviation]]);
        aggregateTable = new google.visualization.Table(document.getElementById('response-time-aggregate-table'));
        aggregateTable.draw(aggregateData);
    }

    function drawProcessingTimeScatterChart (result,aggregate) {
        var array = [],
            data = new google.visualization.DataTable(),
            options = {
                chartArea: {top: 20, left: 60, width: '100%'},
                height: 500,
                hAxis: {title: 'Time elapsed since first test (ms)'},
                vAxis: {title: 'Processing Time (ms)'},
                pointSize: 4,
                legend: {position: 'none'},
                explorer: { actions: ['dragToZoom', 'rightClickToReset'] },
                trendlines: {
                    0: { color: 'green', type: 'exponential', pointSize: 0, opacity: 0.5}
                }
            };

        for (var i = result.length - 1; i >= 0; i--) {
            var time = new Date(result[i][0]),
                pt = result[i][2]-result[i][1];
            array.push( [result[i][0]-result[0][0], pt, time.toTimeString().substring(0,8)+':'+time.getMilliseconds()+' -> '+pt+'ms'] );
        };

        data.addColumn('number', 'Time-point of receiving first byte');
        data.addColumn('number', 'Processing Time (ms)');
        data.addColumn({type: 'string', role: 'tooltip'});
        data.addRows(array);

        processingTimeScatterChart = new google.visualization.ScatterChart(document.getElementById('processing-time-scatter'));
        processingTimeScatterChart.draw(data, options);

        var aggregateData = new google.visualization.DataTable(),
            statistic = Statistic(array,1);
        aggregateData.addColumn('number', 'Min (ms)');
        aggregateData.addColumn('number', 'Max (ms)');
        aggregateData.addColumn('number', 'Average (ms)');
        aggregateData.addRows([[aggregate[5],aggregate[6],statistic.mean]]);
        aggregateTable = new google.visualization.Table(document.getElementById('processing-time-aggregate-table'));
        aggregateTable.draw(aggregateData);
    }

    function drawTestNodeDistribution (result) {
        var data = new google.visualization.DataTable(),
            options = {
                displayMode: 'markers',
                colorAxis: {colors: ['#e7711c', '#4374e0']}, // orange to blue
                magnifyingGlass: {enable: true, zoomFactor: 5}
            },
            array = [],
            obj = {};

        data.addColumn('string', 'Country');
        data.addColumn('number', 'Test Number');

        for (var i = result.length - 1; i >= 0; i--) {
            if(obj[result[i][5]]) obj[result[i][5]]++;
            else obj[result[i][5]] = 1;
        };
        array = Object.keys(obj).map(function(key) {
            return [ key, this[key] ];
        }, obj);

        data.addRows(array);

        nodeDistributionChart = new google.visualization.GeoChart(document.getElementById('test-node-distribution-geochart'));
        nodeDistributionChart.draw(data, options);

        nodeDistributionTable = new google.visualization.Table(document.getElementById('test-node-distribution-table'));
        nodeDistributionTable.draw(data, { showRowNumber: true,page: 'enable',pageSize: 10, sortColumn:1 });

        google.visualization.events.addListener(nodeDistributionChart, 'select', function() {
            nodeDistributionTable.setSelection(nodeDistributionChart.getSelection());
        });
    }

    function drawResultTable (result) {
        var data = new google.visualization.DataTable(),
            options = {
                showRowNumber: true,
                // page: 'enable',
                // pageSize: 50,
                sortColumn: 0
            },
            date,
            array = [];

        data.addColumn('string', 'Time');
        data.addColumn('number', 'Latency (ms)');
        data.addColumn('number', 'Response Time (ms)');
        data.addColumn('number', 'Processing Time (ms)');
        data.addColumn('number', 'Status Code');
        data.addColumn('number', 'Size (bytes)');
        data.addColumn('string', 'Country Code');
        data.addColumn('string', 'Browser');

        for (var i = result.length - 1; i >= 0; i--) {
            date = new Date(result[i][0]);
            array[i] = [];
            array[i][0] = date.toTimeString().substring(0,8)+':'+date.getMilliseconds();
            array[i][1] = result[i][1];
            array[i][2] = result[i][2];
            array[i][3] = result[i][2] - result[i][1];
            array[i][4] = result[i][3];
            array[i][5] = result[i][4];
            array[i][6] = result[i][5];
            array[i][7] = result[i][6];
        };
        data.addRows(array);

        resultTable = new google.visualization.Table(document.getElementById('result-table'));
        resultTable.draw(data, options);
    }

}