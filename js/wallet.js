(function (window) {
    var ADDRESS = "wallet.address",
        PRIVATE_KEY = "wallet.private_key",
        IS_ENCRYPTED = "wallet.is_encrypted",
        LAST_BALANCE = "wallet.last_balance",
        balance = 0,
        address = '',
        privateKey = '',
        isEncrypted = false,
        websocket = null,
        balanceListener = null;

    var wallet = function () {};
    wallet.prototype = {

        getAddress: function () {
            return address;
        },

        getBalance: function () {
            return balance;
        },

        isEncrypted: function () {
            return isEncrypted;
        },

        setBalanceListener: function (listener) {
            balanceListener = listener;
        },

        send: function (sendAddress, amount, fee, password, listener) {
            var decryptedPrivateKey = this.getDecryptedPrivateKey(password);
            if (decryptedPrivateKey) {
                var req = new XMLHttpRequest();
                req.onreadystatechange = function () {
                    if (req.readyState === 4) {
                        if (req.status == 500) {
                            listener(false, 'Insufficient funds');
                        } else {
                            var json = JSON.parse(req.responseText);
                            var inputs = json.unspent_outputs;
                            var selectedOuts = [];

                            var eckey = new Bitcoin.ECKey(decryptedPrivateKey);
                            var totalInt = Number(amount) + Number(fee);
                            var txValue = new BigInteger('' + totalInt, 10);
                            var availableValue = BigInteger.ZERO;
                            var i;
                            for (i = 0; i < inputs.length; i++) {
                                selectedOuts.push(inputs[i]);
                                availableValue = availableValue.add(new BigInteger('' + inputs[i].value, 10));
                                if (availableValue.compareTo(txValue) >= 0) break;
                            }
                            if (availableValue.compareTo(txValue) < 0) {
                                listener(false, 'Insufficient funds');
                                return;
                            }

                            var sendTx = new Bitcoin.Transaction();
                            for (i = 0; i < selectedOuts.length; i++) {
                                var hash = Crypto.util.bytesToBase64(Crypto.util.hexToBytes(selectedOuts[i].tx_hash));
                                var script = new Bitcoin.Script(Crypto.util.hexToBytes(selectedOuts[i].script));
                                var txin = new Bitcoin.TransactionIn({
                                    outpoint: {
                                        hash: hash,
                                        index: selectedOuts[i].tx_output_n
                                    },
                                    script: script,
                                    sequence: 4294967295
                                });
                                sendTx.addInput(txin);
                            }

                            sendTx.addOutput(new Bitcoin.Address(sendAddress), new BigInteger('' + amount, 10));

                            var changeValue = availableValue.subtract(txValue);
                            if (changeValue.compareTo(BigInteger.ZERO) > 0) {
                                sendTx.addOutput(eckey.getBitcoinAddress(), changeValue);
                            }

                            var hashType = 1; // SIGHASH_ALL
                            for (i = 0; i < sendTx.ins.length; i++) {
                                var connectedScript = sendTx.ins[i].script;
                                var hash = sendTx.hashTransactionForSignature(connectedScript, i, hashType);
                                var signature = eckey.sign(hash);
                                signature.push(parseInt(hashType, 10));
                                var pubKey = eckey.getPub();
                                var script = new Bitcoin.Script();
                                script.writeBytes(signature);
                                script.writeBytes(pubKey);
                                sendTx.ins[i].script = script;
                            }
                            var data = 'tx=' + Crypto.util.bytesToHex(sendTx.serialize());

                            var newReq = new XMLHttpRequest();
                            newReq.open('POST', 'https://blockchain.info/pushtx', false);
                            newReq.setRequestHeader('Content-type', 'application/x-www-form-urlencoded');
                            newReq.send(data);
                            if (newReq.status == 200) {
                                listener(true);
                            } else {
                                listener(false, 'Unknown error');
                            }
                        }
                    }
                };
                req.open('GET', 'https://blockchain.info/unspent?address=' + address, true);
                req.send();
                balanceListener(balance - amount - fee);
            } else {
                listener(false, 'Incorrect password');
            }
        },

        generateAddress: function (listener) {
            if (!address.length) {
                var eckey = new Bitcoin.ECKey(false);
                privateKey = eckey.getExportedPrivateKey();
                address = eckey.getBitcoinAddress().toString();
                balance = 0;
                isEncrypted = false;
                updateBalance();
                walletStorage.setItems([ADDRESS, IS_ENCRYPTED, PRIVATE_KEY], [address, isEncrypted, privateKey], listener);
            } else {
                listener(false);
            }
        },

        restoreAddress: function (listener) {
              walletStorage.getItems([ADDRESS, PRIVATE_KEY, IS_ENCRYPTED], function (values) {
                  if (values[0]) {
                      address = values[0];
                      privateKey = values[1];
                      isEncrypted = values[2];
                      updateBalance();
                      listener(true);
                  } else {
                      listener(false);
                  }
              });
        },

        importAddress: function (_privateKey, listener) {
            if (!address.length) {
                try {
                    var eckey = new Bitcoin.ECKey(_privateKey);
                    privateKey = eckey.getExportedPrivateKey();
                    address = eckey.getBitcoinAddress().toString();
                    balance = 0;
                    isEncrypted = false;
                    updateBalance();
                    walletStorage.setItems([ADDRESS, IS_ENCRYPTED, PRIVATE_KEY], [address, isEncrypted, privateKey], listener);
                } catch (e) {
                    listener(false);
                }
            } else {
                listener(false)
            }
        },

        deleteAddress: function (password, listener) {
            if (this.validatePassword(password)) {
                if (websocket) {
                    websocket.close();
                    websocket = null;
                }
                balance = 0;
                address = '';
                privateKey = '';
                isEncrypted = false;
                walletStorage.removeItems([ADDRESS, PRIVATE_KEY, IS_ENCRYPTED, LAST_BALANCE], listener);
            } else {
                listener(false);
            }
        },

        updatePassword: function (password, newPassword, listener) {
            var decryptedPrivateKey = this.getDecryptedPrivateKey(password);
            if (decryptedPrivateKey) {
                if (newPassword) {
                    privateKey = CryptoJS.AES.encrypt(decryptedPrivateKey, newPassword);
                    isEncrypted = true;
                } else {
                    privateKey = decryptedPrivateKey;
                    isEncrypted = false;
                }
                walletStorage.setItems([IS_ENCRYPTED, PRIVATE_KEY], [isEncrypted, privateKey], listener);
            } else {
                listener(false);
            }
        },

        validatePassword: function (password) {
            if (isEncrypted) {
                try {
                    var decryptedPrivateKey = CryptoJS.AES.decrypt(privateKey, password).toString(CryptoJS.enc.Utf8);
                    return decryptedPrivateKey;
                } catch (e) {
                    return false;
                }
            } else {
                return true;
            }
        },

        getDecryptedPrivateKey: function (password) {
            if (isEncrypted) {
                var decryptedPrivateKey = CryptoJS.AES.decrypt(privateKey, password);
                try {
                    if (!decryptedPrivateKey.toString(CryptoJS.enc.Utf8)) {
                        return null;
                    }
                } catch (e) {
                    return null;
                }
                return decryptedPrivateKey.toString(CryptoJS.enc.Utf8);
            } else {
                return privateKey;
            }
            return decryptedPrivateKey;
        }

    };

    function updateBalance() {
        if (address.length) {
            walletStorage.getItems([LAST_BALANCE], function (items) {
                if (items[0]) {
                    balance = items[0];
                    balanceListener(balance);
                }
            });
            var req = new XMLHttpRequest();
            req.onreadystatechange = function () {
                if (req.readyState === 4) {
                    balance = req.responseText;
                    walletStorage.setItems([LAST_BALANCE], [balance], function () {
                        if (balanceListener) balanceListener(balance);
                    });
                    if (websocket) {
                        websocket.close();
                    }
                    websocket = new WebSocket("ws://ws.blockchain.info:8335/inv");
                    websocket.onopen = function() {
                        websocket.send('{"op":"addr_sub", "addr":"' + address + '"}');
                    };
                    websocket.onmessage = function (evt) {
                        var json = JSON.parse(evt.data);
                        var inputs = json.x.inputs;
                        var outputs = json.x.out;
                        var i;
                        for (i = 0; i < inputs.length; i++) {
                            var input = inputs[i].prev_out;
                            if (input.addr === address) {
                                balance = Number(balance) - Number(input.value);
                            }
                        }
                        for (i = 0; i < outputs.length; i++) {
                            var output = outputs[i];
                            if (output.addr === address) {
                                balance = Number(balance) + Number(output.value);
                            }
                        }
                        walletStorage.setItems([LAST_BALANCE], [balance], function () {
                            if (balanceListener) balanceListener(balance);
                        });
                    };
                }
            };
            req.open('GET', 'https://blockchain.info/q/addressbalance/' + address, true);
            req.send();
        }
    };

    window.wallet = new wallet();
})(window);