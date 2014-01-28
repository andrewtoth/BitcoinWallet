$(document).ready(function () {
    var satoshis = 100000000,
    FEE = satoshis * .0001,
    BTCUnits = 'BTC',
    BTCMultiplier = satoshis,
    clickX,
    clickY,
    port = null;

    $(document).on('contextmenu', function (e) {
        clickX = e.clientX;
        clickY = e.clientY;
        if (port) {
            port.disconnect();
        }
        port = chrome.runtime.connect();
        port.onMessage.addListener(function(response) {
            var rect = null;
            if (response.address) {
                rect = window.getSelection().getRangeAt(0).getBoundingClientRect();
            }
            showPopup(response.address, null, rect);
        });
    });

    $('body').on('click', 'a', function (e) {
        clickX = e.clientX;
        clickY = e.clientY;
        var href = $(this).attr('href');
        if (/^bitcoin:[13][1-9A-HJ-NP-Za-km-z]{26,33}/.test(href)) {
            var addresses = href.match(/[13][1-9A-HJ-NP-Za-km-z]{26,33}/);
            var address = null;
            if (addresses) {
                address = addresses[0];
            }
            var amounts = href.match(/amount=\d+\.?\d*/);
            var amount = null;
            if (amounts) {
                amount = Number(amounts[0].substring(7)) * satoshis;
            }
            showPopup(address, amount, this.getBoundingClientRect());
            return false;
        }
    });

    function showPopup(address, amount, rect) {
        var regex = /^[13][1-9A-HJ-NP-Za-km-z]{26,33}$/;
        var iframe = document.createElement('iframe'),
            yPos,
            xPos;

        if (rect) {
            yPos = Number(rect.bottom) + Number(window.pageYOffset);
            xPos = Number(rect.left) + Number(window.pageXOffset) + Number(rect.right-rect.left)/2 - 85;
        } else {
            yPos = Number(clickY) + Number(window.pageYOffset);
            xPos = Number(clickX) + Number(window.pageXOffset);
        }

        if (!address || !regex.test(String(address))) {
            address = null;
        } else {
            try {
                new Bitcoin.Address(address);
            } catch (e) {
                address = null;
            }
        }

        iframe.src = 'about:blank';
        document.body.appendChild(iframe);
        var request = new XMLHttpRequest()
        request.open('GET', chrome.extension.getURL("paypopup.html"), false);
        request.send(null);
        var text = request.response;
        text = text.replace(/css\//g, chrome.extension.getURL('') + 'css/');
        text = text.replace(/js\//g, chrome.extension.getURL('') + 'js/');

        iframe.contentWindow.document.open('text/html', 'replace');
        iframe.contentWindow.document.write(text);
        iframe.contentWindow.document.close();
        iframe.setAttribute('style', 'background-color: transparent; width: 210px; height: 210px; position: absolute; top: ' + yPos + 'px; left: ' + xPos + 'px; z-index: ' + 2147483647 + '; border: 0px;');
        iframe.setAttribute('allowtransparency', 'true');
        iframe.frameBorder = "0";
        $(iframe.contentWindow).ready(function () {
            var $iframe = $(iframe.contentWindow.document);

            wallet.setBalanceListener(function (balance) {
                if (!wallet.isEncrypted()) {
                    $iframe.find('#password').parent().hide();
                }
                currencyManager.getBTCUnits(function (units) {
                    BTCUnits = units;
                    if (units === 'µBTC') {
                        BTCMultiplier = satoshis / 1000000;
                    } else if (units === 'mBTC') {
                        BTCMultiplier = satoshis / 1000;
                    } else {
                        BTCMultiplier = satoshis;
                    }
                    $iframe.find('#amount').attr('placeholder', 'Amount (' + BTCUnits + ')').attr('step', 100000 / BTCMultiplier);
                });
            });
            wallet.restoreAddress(function (status) {
                if (!status) {
                    wallet.generateAddress(function (status) {});
                }
            });

            $iframe.find('#progress').hide();
            $iframe.find('.alert').hide();
            if (address) {
                $iframe.find('#address').val(address).parent().hide();
            } else {
                $iframe.find('.arrow').hide();
            }

            if (amount) {
                $iframe.find('#amount').parent().hide();
                updateButton(amount);
            } else {
                $iframe.find('#amount').on('keyup change', function (e) {
                    var value = Math.floor(Number($iframe.find('#amount').val() * BTCMultiplier));
                    updateButton(value);
                });
            }

            function updateButton(value) {
                currencyManager.getExchangeRate(function (rate) {
                    currencyManager.getSymbol(function (symbol, beforeOrAfter) {
                        var text = 'Send';
                        if (value > 0) {
                            if (beforeOrAfter === 'before') {
                                text += ' (' + symbol + (value / satoshis * rate).formatMoney(2) + ')';
                            } else {
                                text += ' (' + (value / satoshis * rate).formatMoney(2) + symbol + ')';
                            }
                        }
                        $iframe.find('#button').text(text);
                    });
                });
            };

            $iframe.find('#main').hide().fadeIn('fast');

            $iframe.find('#button').click(function () {
                var validAmount = true,
                    validAddress = true,
                    newAmount;
                if (!amount) {
                    var balance = wallet.getBalance();
                    newAmount = Math.floor(Number($iframe.find('#amount').val() * BTCMultiplier));
                } else {
                    newAmount = amount;
                }
                var balance = wallet.getBalance();
                if (newAmount <= 0) {
                   validAmount = false;
                } else if (newAmount + FEE > balance) {
                   validAmount = false;
                }

                var regex = /^[13][1-9A-HJ-NP-Za-km-z]{26,33}$/;
                var newAddress;
                if (!address) {
                    newAddress = $iframe.find('#address').val();
                    if (!regex.test(String(newAddress))) {
                        validAddress = false;
                    } else {
                        try {
                            new Bitcoin.Address(newAddress);
                        } catch (e) {
                            validAddress = false;
                        }
                    }
                } else {
                    newAddress = address;
                }

                $iframe.find('#amount').parent().removeClass('has-error');
                $iframe.find('#address').parent().removeClass('has-error');
                $iframe.find('#password').parent().removeClass('has-error');
                if (!validAddress) {
                    $iframe.find('#errorAlert').text('Invalid address').slideDown();
                    $iframe.find('#address').parent().addClass('has-error');
                } else if (!validAmount) {
                    $iframe.find('#errorAlert').text('Insufficient funds').slideDown();
                    $iframe.find('#amount').parent().addClass('has-error');
                } else if (!navigator.onLine) {
                    $iframe.find('#errorAlert').text('Connection offline').slideDown();
                    $iframe.find('#amount').parent().addClass('has-error');
                } else {
                    $(document).off('click.wallet contextmenu.wallet');
                    $iframe.find('#errorAlert').slideUp();
                    $iframe.find('#amount').parent().fadeOut('fast');
                    $iframe.find('#address').parent().fadeOut('fast');
                    $iframe.find('#password').parent().fadeOut('fast');
                    $iframe.find('#button').fadeOut('fast', function () {
                        $iframe.find('#progress').fadeIn('fast', function () {
                            wallet.send(newAddress, newAmount, FEE, $iframe.find('#password').val(), function (status, message) {
                                if (status) {
                                    $iframe.find('#progress').fadeOut('fast', function () {
                                        $iframe.find('#successAlert').fadeIn('fast').delay(1000).fadeIn('fast', removeFrame);
                                    });
                                } else {
                                    $iframe.find('#progress').fadeOut('fast', function () {
                                        if (message === 'Incorrect password') {
                                            $iframe.find('#password').parent().addClass('has-error');
                                        } else if (message === 'Insufficient funds') {
                                            $iframe.find('#amount').parent().addClass('has-error');
                                        }
                                        $iframe.find('#errorAlert').text(message).slideDown();
                                        if (!address) {
                                            $iframe.find('#address').parent().fadeIn();
                                        }
                                        if (!amount) {
                                            $iframe.find('#amount').parent().fadeIn();
                                        }
                                        if (wallet.isEncrypted()) {
                                            $iframe.find('#password').parent().fadeIn();
                                        }
                                        $iframe.find('#button').fadeIn();
                                        $(document).on('click.wallet contextmenu.wallet', removeFrame);
                                    });
                                }
                            });
                        });
                    });
                }
            });

        });

        $(document).on('click.wallet contextmenu.wallet', removeFrame);

        function removeFrame() {
            $(document).off('click.wallet contextmenu.wallet');
            $(iframe).fadeOut('fast', function () {
                $(this).remove();
            });
        };
    };

    Number.prototype.formatMoney = function(c, d, t){
        var n = this,
            c = isNaN(c = Math.abs(c)) ? 2 : c,
            d = d == undefined ? "." : d,
            t = t == undefined ? "," : t,
            s = n < 0 ? "-" : "",
            i = parseInt(n = Math.abs(+n || 0).toFixed(c)) + "",
            j = (j = i.length) > 3 ? j % 3 : 0;
        return s + (j ? i.substr(0, j) + t : "") + i.substr(j).replace(/(\d{3})(?=\d)/g, "$1" + t) + (c ? d + Math.abs(n - i).toFixed(c).slice(2) : "");
    };

});