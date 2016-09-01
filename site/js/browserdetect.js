/**
 * @author http://www.quirksmode.org/js/detect.html
 */

var BrowserInfo = {
	init: function () {
		this.browser = this.searchString(this.dataBrowser) || 'unknown_browser';
		this.version = this.searchVersion(navigator.userAgent) || this.searchVersion(navigator.appVersion) || 'unknown_version';
		this.os = this.searchString(this.dataOS) || 'unknown_os';
	},
	searchString: function (data) {
		for (var i=0;i<data.length;i++)	{
			var dataString = data[i].string;
			var dataProp = data[i].prop;
			this.versionSearchString = data[i].versionSearch || data[i].identity;
			if (dataString) {
				if (dataString.indexOf(data[i].subString) != -1)
					return data[i].identity;
			}
			else if (dataProp)
				return data[i].identity;
		}
	},
	searchVersion: function (dataString) {
		var index = dataString.indexOf(this.versionSearchString);
		if (index == -1) return;
		return parseFloat(dataString.substring(index+this.versionSearchString.length+1));
	},
	dataBrowser: [
		{
			string:  navigator.vendor,
			subString: 'Opera',
			identity: 'Opera',
			versionSearch: 'Version'
		},
		{
			string: navigator.userAgent,
			subString: 'Chrome',
			identity: 'Chrome'
		},
		{
			string: navigator.userAgent,
			subString: 'CriOS',
			identity: 'Chrome'
		},
		{
			string: navigator.vendor,
			subString: 'Apple',
			identity: 'Safari',
			versionSearch: 'Version'
		},
		{
			string: navigator.userAgent,
			subString: 'Firefox',
			identity: 'Firefox'
		},
		{
			string: navigator.userAgent,
			subString: 'MSIE',
			identity: 'IE',
			versionSearch: 'MSIE'
		},
		{
			string: navigator.userAgent,
			subString: '.NET',
			identity: 'IE',
			versionSearch: 'MSIE'
		},
		{
			string: navigator.userAgent,
			subString: 'Gecko',
			identity: 'Mozilla',
			versionSearch: 'rv'
		},
		{ 		// for older Netscapes (4-)
			string: navigator.userAgent,
			subString: 'Mozilla',
			identity: 'Netscape',
			versionSearch: 'Mozilla'
		}
	],
	dataOS : [
		{
			string: navigator.platform,
			subString: 'Win',
			identity: 'Windows'
		},
		{
			string: navigator.platform,
			subString: 'Mac',
			identity: 'Mac'
		},
		{
			string: navigator.platform,
			subString: 'iPhone',
			identity: 'iPhone'
	    },
	    {
			string: navigator.platform,
			subString: 'iPad',
			identity: 'iPad'
	    },
	    {
			string: navigator.userAgent,
			subString: 'Android',
			identity: 'Android'
	    },
		{
			string: navigator.platform,
			subString: 'Linux',
			identity: 'Linux'
		}
	]

};