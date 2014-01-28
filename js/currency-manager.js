(function (window) {
    var EXCHANGE_RATE = 'wallet.currency.exchange_rate',
        BTC_UNITS = 'wallet.prefs.btc_units',
        CURRENCY = 'wallet.prefs.currency';

    var currencyManager = function () {};
    currencyManager.prototype = {
        getExchangeRate: function (listener) {
            return walletStorage.getItems([EXCHANGE_RATE], function (values) {
                listener(values[0]);
            });
        },

        updateExchangeRate: function (listener) {
            this.getCurrency(function (currency) {
                var req = new XMLHttpRequest();
                req.onreadystatechange = function () {
                    if (req.readyState === 4) {
                        var json = JSON.parse(req.responseText);
                        walletStorage.setItems([EXCHANGE_RATE], [json['24h_avg']], function () {
                            if (listener) listener(json['24h_avg']);
                        });
                    }
                };
                req.open('GET', 'https://api.bitcoinaverage.com/ticker/' + currency, true);
                req.send();
            });
        },

        getSymbol: function (listener) {
            this.getCurrency(function (currency) {
                switch (currency) {
                    case 'AUD':
                    case 'CAD':
                    case 'NZD':
                    case 'SGD':
                    case 'USD':
                        listener('$', 'before');
                        break;
                    case 'BRL':
                        listener('R$', 'before');
                        break;
                    case 'CHF':
                        listener(' Fr.', 'after');
                        break;
                    case 'CNY':
                    case 'JPY':
                        listener('¥', 'before');
                        break;
                    case 'CZK':
                        listener(' Kč', 'after');
                        break;
                    case 'EUR':
                        listener('€', 'before');
                        break;
                    case 'GBP':
                        listener('£', 'before');
                        break;
                    case 'ILS':
                        listener('₪', 'before');
                        break;
                    case 'NOK':
                    case 'SEK':
                        listener(' kr', 'after');
                        break;
                    case 'PLN':
                        listener('zł', 'after');
                        break;
                    case 'RUB':
                        listener(' RUB', 'after');
                        break;
                    case 'ZAR':
                        listener(' R', 'after');
                        break;
                }
            });
        },

        getAvailableCurrencies: function () {
            return ['AUD', 'BRL', 'CAD', 'CHF', 'CNY', 'CZK', 'EUR', 'GBP', 'ILS', 'JPY', 'NOK', 'NZD', 'PLN', 'RUB', 'SEK', 'SGD', 'USD', 'ZAR'];
        },

        getBTCUnits: function (listener) {
            walletStorage.getItems([BTC_UNITS], function (values) {
                if (!values[0]) {
                    walletStorage.setItems([BTC_UNITS], ['BTC'], function (status) {
                        listener('BTC');
                    });
                } else {
                    listener(values[0]);
                }
            });
        },

        setBTCUnits: function (units, listener) {
            walletStorage.setItems([BTC_UNITS], [units], listener);
        },

        getCurrency: function (listener) {
            walletStorage.getItems([CURRENCY], function (values) {
                if (!values[0]) {
                    walletStorage.setItems([CURRENCY], ['USD'], function (status) {
                        listener('USD');
                    });
                } else {
                    listener(values[0]);
                }
            });
        },

    };

    var ret = new currencyManager();

    currencyManager.prototype.setCurrency = function (currency, listener) {
        walletStorage.setItems([CURRENCY], [currency], function () {
            ret.updateExchangeRate(function() {});
            listener();
        });
    }

    ret.updateExchangeRate();

    window.currencyManager = ret;

})(window);