(function (window) {
    var currencyManager = function () {};
    currencyManager.prototype = {

        updateExchangeRate: function () {
            return preferences.getCurrency().then(function (currency) {
                return ajax.getJSON('https://api.bitcoinaverage.com/ticker/' + currency);
            }).then(function (response) {
                return preferences.setExchangeRate(response['24h_avg']);
            });
        },

        getSymbol: function () {
            return preferences.getCurrency().then(function (currency) {
                switch (currency) {
                    case 'AUD':
                    case 'CAD':
                    case 'NZD':
                    case 'SGD':
                    case 'USD':
                        return(['$', 'before']);
                    case 'BRL':
                        return(['R$', 'before']);
                    case 'CHF':
                        return([' Fr.', 'after']);
                    case 'CNY':
                    case 'JPY':
                        return(['¥', 'before']);
                    case 'CZK':
                        return([' Kč', 'after']);
                    case 'EUR':
                        return(['€', 'before']);
                    case 'GBP':
                        return(['£', 'before']);
                    case 'ILS':
                        return(['₪', 'before']);
                    case 'NOK':
                    case 'SEK':
                        return([' kr', 'after']);
                    case 'PLN':
                        return(['zł', 'after']);
                    case 'RUB':
                        return([' RUB', 'after']);
                    case 'ZAR':
                        return([' R', 'after']);
                    default:
                        return(['$', 'before']);
                }
            });
        },

        getAvailableCurrencies: function () {
            return ['AUD', 'BRL', 'CAD', 'CHF', 'CNY', 'CZK', 'EUR', 'GBP', 'ILS', 'JPY', 'NOK', 'NZD', 'PLN', 'RUB', 'SEK', 'SGD', 'USD', 'ZAR'];
        }
    };

    var ret = new currencyManager();

    ret.updateExchangeRate();

    window.currencyManager = ret;

})(window);