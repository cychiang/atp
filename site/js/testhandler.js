/**
 * @author Hung Yu Chen <soulinlove541@gmail.com>
 * @version 1.0
 * @copyright Hung Yu Chen 2013
 */

self.addEventListener('message', function(e) {
    var cmd = e.data.cmd,
        tester;

    switch (cmd) {
        case 'start':
            tester = new Tester(e.data.taskList, e.data.timer, e.data.timeOffset);
            tester.responseTime();
            break;
        case 'stop':
            delete tester;
            self.close();
            break;
        default:
            self.postMessage('unknown command: ' + cmd);
    };
}, false);

function Tester(tl,t,o){
    var xhr,
        taskList = tl,
        timer = t,
        testStartTime = 0,
        rcvFirstByteTime = 0,
        taskIdx = 0,
        timeOffset = o;
        
    var latency = -1,
        loadTime = -1,
        statusCode = -1;

    this.responseTime = function (){
        xhr = new XMLHttpRequest();

        xhr.onreadystatechange = function() {
            var ct = new Date().getTime() + timeOffset; // current time

            switch (xhr.readyState) {
            case 1:
                testStartTime = ct;
                break;
            case 2:
                rcvFirstByteTime = ct;
                latency = ct - testStartTime;
                break;
            case 4:
                loadTime = ct - testStartTime;
                statusCode = xhr.status;
                if(statusCode == 0) {
                    self.postMessage({
                        'event': 'error'
                    });
                } else {
                    var startTime = new Date(testStartTime);
                    self.postMessage({
                        'event': 'result',
                        'result': [
                            rcvFirstByteTime,
                            latency,
                            loadTime,
                            statusCode,
                            xhr.responseText.length
                        ]
                    });

                    taskIdx++;
                    if(taskIdx != taskList.length){
                        setTimeout(send,timer.delayBase+Math.random()*timer.delayOffset);
                    } else {
                        self.postMessage({
                            'event': 'finish'
                        });
                    }
                }
                break;
            default:
                break;
            }
        }

        xhr.onload = function() {
            self.postMessage('there was an error making the test request~~.');
        };

        xhr.onerror = function() {
            self.postMessage('there was an error making the test request.');
        };
        send();
    }

    function send () {
        openCORSRequest(taskList[taskIdx].method, taskList[taskIdx].url+taskList[taskIdx].path, taskList[taskIdx].args);
        if (!xhr) {
            throw new Error('CORS not supported');
        }
        xhr.send();
    }

    function openCORSRequest (method, url, args) {
        if(args != '') url += '?' + args;
        url += (url.match(/\?/) == null ? '?' : '&') + (new Date()).getTime();

        if ('withCredentials' in xhr) { // 'withCredentials' only exists on XMLHTTPRequest2 objects.
            xhr.open(method, url, true);
        } else if (typeof XDomainRequest != 'undefined') { // XDomainRequest only exists in IE, and is IE's way of making CORS requests.
            xhr = new XDomainRequest();
            xhr.open(method, url);
        } else { // Otherwise, CORS is not supported by the browser.
            xhr = null;
        }
    }
}