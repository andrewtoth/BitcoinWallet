(function () {

    var responsePort = null;

    function menuOnClick(info) {
        if (info.selectionText) {
            responsePort.postMessage({'address': info.selectionText});
        } else {
            responsePort.postMessage({});
        }
    }
    chrome.contextMenus.create({'title': 'Pay %s', 'contexts': ['selection'], 'onclick': menuOnClick});
    chrome.contextMenus.create({'title': 'Send BTC', 'contexts': ['page'], 'onclick': menuOnClick});

    chrome.runtime.onConnect.addListener(function(port) {
        responsePort = port;
    });

    chrome.runtime.onMessage.addListener(function (request) {
        if (request.address) {
            chrome.tabs.create({url: 'http://blockchain.info/address/' + request.address});
        }
    });

})();