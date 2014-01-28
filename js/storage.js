(function (window) {

    var walletStorage = function() {};

    walletStorage.prototype = {

        getItems: function (keys, listener) {
            chrome.storage.sync.get(keys, function (items) {
                var values = [];
                for (var i = 0; i < keys.length; i++) {
                    values.push(items[keys[i]]);
                }
                if (listener) listener(values);
            });
        },

        removeItems: function (keys, listener) {
            chrome.storage.sync.remove(keys, function () {
                if (listener) listener(true);
            });
        },

        setItems: function (keys, values, listener) {
            var object = {};
            for (var i = 0; i < keys.length; i++) {
                object[keys[i]] = values[i];
            }
            chrome.storage.sync.set(object, function () {
                if (listener) listener(true);
            });
        }
    };

    window.walletStorage = new walletStorage();
})(window);