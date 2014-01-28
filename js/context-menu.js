(function () {

    var responsePort = null;

    function menuOnClick(info, tab) {
        if (info.selectionText) {
            responsePort.postMessage({'address': info.selectionText});
        } else {
            responsePort.postMessage({});
        }
    };
    chrome.contextMenus.create({'title': 'Pay %s', 'contexts': ['selection'], 'onclick': menuOnClick});
    chrome.contextMenus.create({'title': 'Send BTC', 'contexts': ['page'], 'onclick': menuOnClick});

    chrome.runtime.onConnect.addListener(function(port) {
        responsePort = port;
    });

})();