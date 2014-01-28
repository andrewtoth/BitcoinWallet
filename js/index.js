$(document).ready(function () {

    var $amountAlert = $('#amountAlert').hide(),
        $addressAlert = $('#addressAlert').hide(),
        $successAlert = $('#successAlert').hide(),
        $successAlertLabel = $('#successAlertLabel'),
        $amount = $('#amount'),
        val = '',
        address = '',
        satoshis = 100000000,
        FEE = satoshis * .0001,
        BTCUnits = 'BTC',
        BTCMultiplier = satoshis;


    // Setup the wallet, page values and callbacks
    currencyManager.getBTCUnits(function (units) {
        setupWallet();
        setBTCUnits(units);
    });

    function setupWallet() {
        wallet.setBalanceListener(function (balance) {
            setBalance(balance);
        });

        if (!wallet.getAddress().length) {
            wallet.restoreAddress(function (status) {
                if (!status) {
                    wallet.generateAddress(function (status) {
                        if (!status) {
                            alert('Failed to generate wallet. Refresh and try again.');
                        } else {
                            setQRCodes();
                        }
                    });
                } else {
                    setQRCodes();
                }
            });
        } else {
            setQRCodes();
        }
    }

    function setQRCodes() {
        $('#qrcode').html(createQRCodeCanvas(wallet.getAddress()));
        $('#textAddress').text(wallet.getAddress());
    }

    $amount.on('keyup change', function (e) {
        val = Math.floor(Number($amount.val() * BTCMultiplier));
        currencyManager.getExchangeRate(function (rate) {
            currencyManager.getSymbol(function (symbol, beforeOrAfter) {
                var text = 'Amount: ';
                if (val > 0) {
                    if (beforeOrAfter === 'before') {
                        text += symbol + (val / satoshis * rate).formatMoney(2);
                    } else {
                        text += (val / satoshis * rate).formatMoney(2) + symbol;
                    }
                }
                $('#amountLabel').text(text);
            });
        });
    });

    function setBTCUnits(units) {
        BTCUnits = units;
        if (units === 'µBTC') {
            BTCMultiplier = satoshis / 1000000;
        } else if (units === 'mBTC') {
            BTCMultiplier = satoshis / 1000;
        } else {
            BTCMultiplier = satoshis;
        }

        setBalance(wallet.getBalance());
        $('#sendUnit').html(BTCUnits);
        $amount.attr('placeholder', '(Plus ' + FEE / BTCMultiplier + ' ' + BTCUnits + ' fee)');
        $amount.attr('step', 100000 / BTCMultiplier)
    };

    function setBalance(balance) {
        $('#balance').text(balance / BTCMultiplier + ' ' + BTCUnits);
    };

    $('#successAlertClose').click(function (e) {
        $successAlert.fadeOut();
    });

    $('#unkownErrorAlertClose').click(function (e) {
        $('#unknownErrorAlert').fadeOut();
    });

    // Send BTC
    $('#sendButton').click(function (e) {
        val = Math.floor(Number($amount.val() * BTCMultiplier));
        address = $('#sendAddress').val();
        var balance = wallet.getBalance();
        var validAmount = true;
        if (val <= 0) {
            validAmount = false;
        } else if (val + FEE > balance) {
            validAmount = false;
        }
        if (validAmount) {
            $amountAlert.slideUp();
        } else {
            $amountAlert.slideDown();
        }

        var regex = /^[13][1-9A-HJ-NP-Za-km-z]{26,33}$/;
        var validAddress = true;
        if (!regex.test(String(address))) {
            validAddress = false;
        } else {
            try {
                new Bitcoin.Address(address);
            } catch (e) {
                validAddress = false;
            }
        }

        if (validAddress) {
            $addressAlert.slideUp();
        } else {
            $addressAlert.slideDown();
        }

        if (validAddress && validAmount) {
            if (wallet.isEncrypted()) {
                currencyManager.getExchangeRate(function (rate) {
                    currencyManager.getSymbol(function (symbol, beforeOrAfter) {
                        var text = 'Are you sure you want to send<br />' + val / BTCMultiplier + ' ' + BTCUnits + ' (<strong>';
                        if (beforeOrAfter === 'before') {
                            text += symbol + (val / satoshis * rate).formatMoney(2);
                        } else {
                            text += (val / satoshis * rate).formatMoney(2) + symbol;
                        }
                        text += '</strong>)<br />to ' + address + ' ?';
                        $('#sendConfirmationText').html(text);
                        $('#sendConfirmationPassword').val(null);
                        $('#sendConfirmationPasswordIncorrect').hide();
                        $('#sendConfirmationModal').modal().show();
                    });
                });
            } else {
                confirmSend();
            }
        }
    });

    $('#confirmSendButton').click(function (e) {
        confirmSend();
    });

    function confirmSend() {
        $('#cover').show();
        var password = $('#sendConfirmationPassword').val();
        wallet.send(address, val, FEE, password, function (status, message) {
            if (status) {
                $amount.val(null);
                $('#sendAddress').val(null);
                $('#amountLabel').text('Amount:');
                var text = 'Sent ' + val / BTCMultiplier + ' ' + BTCUnits + ' to ' + address + '.';
                $successAlertLabel.text(text);
                $successAlert.slideDown();
                $('#sendConfirmationModal').modal('hide');
                $('#cover').fadeOut('slow');
            } else {
                if (wallet.isEncrypted()) {
                    $('#sendConfirmationPasswordIncorrect').text(message).slideDown();
                } else {
                    $('#unknownErrorAlertLabel').text(message);
                    $('#unknownErrorAlert').slideDown();
                }
                $('#cover').hide();
            }
        });
    };

    /*
     *  Settings Menu
     */

    /*
     * Set Password
     */
    var $password = $('#setPasswordPassword'),
        $newPassword = $('#newPassword'),
        $confirmNewPassword = $('#confirmNewPassword'),
        $removePassword = $('#removePassword');

    $('#setPassword').click(function (e) {
        $('#passwordMismatch').hide();
        $('#setPasswordIncorrect').hide();
        $('#setPasswordBlank').hide();
        if (wallet.isEncrypted()) {
            $('#removePasswordDiv').show();
            $('#setPasswordPassword').show();
        } else {
            $('#removePasswordDiv').hide();
            $('#setPasswordPassword').hide();
        }
        $newPassword.show();
        $newPassword.val(null)
        $confirmNewPassword.show();
        $confirmNewPassword.val(null);
        $password.val(null);
        $removePassword.attr('checked', false);
        $('#setPasswordModal').modal().show();
    });

    $removePassword.click(function (e) {
        if (this.checked) {
            $newPassword.val(null).slideUp();
            $confirmNewPassword.val(null).slideUp();
        } else {
            $newPassword.slideDown();
            $confirmNewPassword.slideDown();
        }
    });

    $('#confirmSetPassword').click(function (e) {
        var password = $password.val();
        var newPassword = $newPassword.val();
        var confirmNewPassword = $confirmNewPassword.val();

        var validInput = true;
        if ((wallet.isEncrypted() && !password) || (!$removePassword.is(':checked') && (!newPassword || !confirmNewPassword))) {
            validInput = false;
            $('#setPasswordBlank').slideDown();
        } else {
            $('#setPasswordBlank').slideUp();
        }

        if (validInput && newPassword !== confirmNewPassword) {
            validInput = false;
            $('#passwordMismatch').slideDown();
        } else {
            $('#passwordMismatch').slideUp();
        }

        if (validInput && wallet.isEncrypted() && !wallet.validatePassword(password)) {
            validInput = false;
            $('#setPasswordIncorrect').slideDown();
        } else {
            $('#setPasswordIncorrect').slideUp();
        }

        if (validInput) {
            wallet.updatePassword(String(password), String(newPassword), function () {
                $successAlertLabel.text('New password set.');
                $successAlert.show();
                $('#setPasswordModal').modal('hide');
            });
        }

    });

    /*
     * Currency selection
     */
    $('#setCurrency').click(function (e) {
        currencyManager.getCurrency(function (currency) {
            var currencies = currencyManager.getAvailableCurrencies();
            var tableBody = '';
            for (var i = 0; i < currencies.length/3; i++) {
                tableBody += '<tr>';
                for (var j = i; j <= i+12; j+=6) {
                    tableBody += '<td><div class="radio no-padding"><label><input type="radio" name="' + currencies[j] + '"';
                    if (currencies[j] === currency) {
                        tableBody += ' checked';
                    }
                    tableBody += '>' + currencies[j] + '</label></div></td>';
                }
                tableBody += '</tr>';
            }
            $('#tableBody').html(tableBody);
            $('#setCurrencyModal').modal().show();
            $('.radio').click(function (e) {
                var currency = $.trim($(this).text());
                $('input:radio[name=' + currency + ']').attr('checked', 'checked');
                currencyManager.setCurrency(currency, function () {
                    $('#amountLabel').text('Amount:');
                    $successAlertLabel.text('Currency set to ' + currency + '.');
                    $successAlert.show();
                    $('#setCurrencyModal').modal('hide');
                });
            });
        });
    });

    /*
     * Units selection
     */
    $('#setUnits').click(function (e) {
        currencyManager.getBTCUnits(function (units) {
            var availableUnits = ['BTC', 'mBTC', 'µBTC'];
            var tableBody = '<tr>';
            for (var i = 0; i < availableUnits.length; i++) {
                tableBody += '<td><div class="radio no-padding"><label><input type="radio" name="' + availableUnits[i] + '"';
                if (availableUnits[i] === units) {
                    tableBody += ' checked';
                }
                tableBody += '>' + availableUnits[i] + '</label></div></td>';
            }
            tableBody += '</tr>';
            $('#tableBody').html(tableBody);
            $('#setCurrencyModal').modal().show();
            $('.radio').click(function (e) {
                var units = $.trim($(this).text());
                $('input:radio[name=' + units + ']').attr('checked', 'checked');
                setBTCUnits(units);
                currencyManager.setBTCUnits(units, function () {
                    $successAlertLabel.text('Units set to ' + units + '.');
                    $successAlert.show();
                    $('#setCurrencyModal').modal('hide');
                });
            });
        });
    });

    /*
     *  Show Private Key
     */
    $('#showPrivateKey').click(function (e) {
        var $passwordField = $('#showPrivateKeyPassword');
        var $incorrectAlert = $('#showPrivateKeyPasswordIncorrect');
        $incorrectAlert.hide();
        if (wallet.isEncrypted()) {
            $passwordField.val(null).show();
        } else {
            $passwordField.hide();
        }
        $('#privateKey').hide();
        $('#showPrivateKeyModal').modal().show();
    });

    $('#showPrivateKeyConfirm').click(function (e) {
        var $passwordField = $('#showPrivateKeyPassword');
        var $incorrectAlert = $('#showPrivateKeyPasswordIncorrect');
        if (wallet.isEncrypted() && !wallet.validatePassword($passwordField.val())) {
            $('#showPrivateKeyPasswordIncorrect').slideDown();
        } else {
            $incorrectAlert.slideUp();
            var privateKey = wallet.getDecryptedPrivateKey($passwordField.val());
            $('#privateKeyQRCode').html(createQRCodeCanvas(privateKey));
            $('#privateKeyText').text(privateKey);
            $('#privateKey').slideDown(function () {
                $('#main').height($('#showPrivateKeyModal .modal-dialog').height());
            });
        }
    });

    /*
     *  Import Private Key
     */
    $('#importPrivateKey').click(function (e) {
        var $passwordField = $('#importPrivateKeyPassword');
        var $incorrectAlert = $('#importPrivateKeyPasswordIncorrect');
        var $badPrivateKeyAlert = $('#importPrivateKeyBadPrivateKey');
        $incorrectAlert.hide();
        $badPrivateKeyAlert.hide();
        if (wallet.isEncrypted()) {
            $passwordField.val(null).show();
        } else {
            $passwordField.hide();
        }
        $('#importPrivateKeyPrivateKey').val(null);
        $('#importPrivateKeyModal').modal().show();
    });

    $('#importPrivateKeyConfirm').click(function (e) {
        var $passwordField = $('#importPrivateKeyPassword');
        var $privateKeyField = $('#importPrivateKeyPrivateKey');
        var $incorrectAlert = $('#importPrivateKeyPasswordIncorrect');
        var $badPrivateKeyAlert = $('#importPrivateKeyBadPrivateKey');
        try {
            new Bitcoin.ECKey($privateKeyField.val()).getExportedPrivateKey();
        } catch (e) {
            $badPrivateKeyAlert.slideDown();
            return;
        }
        wallet.deleteAddress($passwordField.val(), function (status) {
            if (!status) {
                $incorrectAlert.slideDown();
            } else {
                $incorrectAlert.slideUp();
                wallet.importAddress($privateKeyField.val(), function (status) {
                    if (status) {
                        setupWallet();
                        $successAlertLabel.text('Private key imported successfully.');
                        $successAlert.show();
                        $('#importPrivateKeyModal').modal('hide');
                    } else {
                        $badPrivateKeyAlert.slideDown();
                    }
                });
            }
        });
    });

    /*
     *  Generate New Wallet
     */
    $('#generateNewWallet').click(function (e) {
        var $passwordField = $('#generateNewWalletPassword');
        var $incorrectAlert = $('#generateNewWalletPasswordIncorrect');
        $incorrectAlert.hide();
        if (wallet.isEncrypted()) {
            $passwordField.show();
            $passwordField.val(null);
        } else {
            $passwordField.hide();
        }
        $('#generateNewWalletModal').modal().show();
    });

    $('#generateNewWalletConfirm').click(function (e) {
        var $passwordField = $('#generateNewWalletPassword');
        var $incorrectAlert = $('#generateNewWalletPasswordIncorrect');
        wallet.deleteAddress($passwordField.val(), function (status) {
            if (!status) {
                $incorrectAlert.slideDown();
            } else {
                setupWallet();
                $successAlertLabel.text('New wallet generated.');
                $successAlert.show();
                $('#generateNewWalletModal').modal('hide');
            }
        });
    });

    $('.modal').on('shown.bs.modal', function() {
        var height = $('#main').height();
        var modalHeight = $(this).find('.modal-dialog').height();
        if (modalHeight > height) {
            $('#main').height(modalHeight);
        }
    })

    $('.modal').on('hidden.bs.modal', function (e) {
        $('#main').height('auto');
    });

    $('#aboutModal').on('click', 'a', function () {
        chrome.tabs.create({url: $(this).attr('href')});
        return false;
    });
});

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

function createQRCodeCanvas(text) {
    var sizeMultiplier = 4;
    var typeNumber;
    var lengthCalculation = text.length * 8 + 12;
    if (lengthCalculation < 72) { typeNumber = 1; }
    else if (lengthCalculation < 128) { typeNumber = 2; }
    else if (lengthCalculation < 208) { typeNumber = 3; }
    else if (lengthCalculation < 288) { typeNumber = 4; }
    else if (lengthCalculation < 368) { typeNumber = 5; }
    else if (lengthCalculation < 480) { typeNumber = 6; }
    else if (lengthCalculation < 528) { typeNumber = 7; }
    else if (lengthCalculation < 688) { typeNumber = 8; }
    else if (lengthCalculation < 800) { typeNumber = 9; }
    else if (lengthCalculation < 976) { typeNumber = 10; }
    var qrcode = new QRCode(typeNumber, QRCode.ErrorCorrectLevel.H);
    qrcode.addData(text);
    qrcode.make();
    var width = qrcode.getModuleCount() * sizeMultiplier;
    var height = qrcode.getModuleCount() * sizeMultiplier;
    // create canvas element
    var canvas = document.createElement('canvas');
    var scale = 10.0;
    canvas.width = width * scale;
    canvas.height = height * scale;
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';
    var ctx = canvas.getContext('2d');
    ctx.scale(scale, scale);
    // compute tileW/tileH based on width/height
    var tileW = width / qrcode.getModuleCount();
    var tileH = height / qrcode.getModuleCount();
    // draw in the canvas
    for (var row = 0; row < qrcode.getModuleCount(); row++) {
        for (var col = 0; col < qrcode.getModuleCount(); col++) {
            ctx.fillStyle = qrcode.isDark(row, col) ? "#000000" : "#ffffff";
            ctx.fillRect(col * tileW, row * tileH, tileW, tileH);
        }
    }
    return canvas;
}