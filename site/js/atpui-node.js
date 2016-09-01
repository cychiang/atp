function AtpUI () {
    (function () {
        $('li a[data-toggle="tab"]').on('shown.bs.tab', function (e) {
            location.hash = $(e.target).attr('href');
            sessionStorage.setItem('currentTab', $(e.target).attr('href'));
        });

        $('.navbar-brand').click(function (e) {
            $('div.navbar-collapse li.active').removeClass('active');
        });
    })();

    this.logout = function () {
         $('div.navbar-collapse li:not(:has([href="#About"]))').addClass('hidden');
         $('div.navbar-collapse li.active').removeClass('active');
         if($('#unread-result')[0]) $('#unread-result')[0].textContent = '';
    };

    this.processNotification = function () {
        if(arguments[0] == 'ready') {
            $('button.disabled').removeClass('disabled');
        }
    };

    this.changeTab = function (tabId) {
        $('li a[href="'+tabId+'"]').tab('show');
    }

}