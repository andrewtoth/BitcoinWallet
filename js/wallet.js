(function (window) {
    var balance = 0,
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

        generateAddress: function () {
            return new Promise(function (resolve, reject) {
                if (!address.length) {
                    var eckey = new Bitcoin.ECKey(false);
                    privateKey = eckey.getExportedPrivateKey();
                    address = eckey.getBitcoinAddress().toString();
                    balance = 0;
                    isEncrypted = false;
                    updateBalance();
                    Promise.all([preferences.setAddress(address), preferences.setPrivateKey(privateKey), preferences.setIsEncrypted(isEncrypted)]).then(function () {
                        resolve();
                    });
                } else {
                    reject(Error('Current address must be deleted'));
                }
            });
        },

        restoreAddress: function () {
            return new Promise(function (resolve, reject) {
                Promise.all([preferences.getAddress(), preferences.getPrivateKey(), preferences.getIsEncrypted()]).then(function (values) {
                    if (values[0]) {
                        address = values[0];
                        privateKey = values[1];
                        isEncrypted = values[2];
                        updateBalance();
                        resolve();
                    } else {
                        reject(Error('No address'));
                    }
                });
            });
        },

        importAddress: function (_privateKey) {
            return new Promise(function (resolve, reject) {
                if (!address.length) {
                    try {
                        var eckey = new Bitcoin.ECKey(_privateKey);
                        privateKey = eckey.getExportedPrivateKey();
                        address = eckey.getBitcoinAddress().toString();
                        balance = 0;
                        isEncrypted = false;
                        updateBalance();
                        Promise.all([preferences.setAddress(address), preferences.setPrivateKey(privateKey), preferences.setIsEncrypted(isEncrypted)]).then(function () {
                            resolve();
                        });
                    } catch (e) {
                        reject(Error('Invalid private key'));
                    }
                } else {
                    reject(Error('Current address must be deleted'));
                }
            });
        },

        validatePassword: function (password) {
            if (isEncrypted) {
                try {
                    return CryptoJS.AES.decrypt(privateKey, password).toString(CryptoJS.enc.Utf8);
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
        }

    };

    function updateBalance() {
        if (address.length) {
            preferences.getLastBalance().then(function (result) {
                balance = result;
                if (balanceListener) balanceListener(balance);
                ajax.get('https://blockchain.info/q/addressbalance/' + address).then(function (response) {
                    balance = response;
                    return preferences.setLastBalance(balance);
                }).then(function () {
                    if (balanceListener) balanceListener(balance);
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
                        preferences.setLastBalance(balance).then(function () {
                            if (balanceListener) balanceListener(balance);
                        });
                    };
                });
            });
        }
    }

    var ret = new wallet();

    wallet.prototype.updatePassword = function (password, newPassword) {
        return new Promise(function (resolve, reject) {
            var decryptedPrivateKey = ret.getDecryptedPrivateKey(password);
            if (decryptedPrivateKey) {
                if (newPassword) {
                    privateKey = CryptoJS.AES.encrypt(decryptedPrivateKey, newPassword);
                    isEncrypted = true;
                } else {
                    privateKey = decryptedPrivateKey;
                    isEncrypted = false;
                }
                Promise.all([preferences.setIsEncrypted(isEncrypted), preferences.setPrivateKey(privateKey)]).then(function () {
                    resolve();
                });
            } else {
                reject(Error('Incorrect password'));
            }
        });
    };

    wallet.prototype.send = function (sendAddress, amount, fee, password) {
        return new Promise(function (resolve, reject) {
            var decryptedPrivateKey = ret.getDecryptedPrivateKey(password);
            if (decryptedPrivateKey) {
                ajax.getJSON('https://blockchain.info/unspent?address=' + address).then(function (json) {
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
                        reject(Error('Insufficient funds'));
                        return  null;
                    } else {
                        var hash,
                            script;
                        var sendTx = new Bitcoin.Transaction();
                        for (i = 0; i < selectedOuts.length; i++) {
                            hash = Crypto.util.bytesToBase64(Crypto.util.hexToBytes(selectedOuts[i].tx_hash));
                            script = new Bitcoin.Script(Crypto.util.hexToBytes(selectedOuts[i].script));
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
                            hash = sendTx.hashTransactionForSignature(connectedScript, i, hashType);
                            var signature = eckey.sign(hash);
                            signature.push(parseInt(hashType, 10));
                            var pubKey = eckey.getPub();
                            script = new Bitcoin.Script();
                            script.writeBytes(signature);
                            script.writeBytes(pubKey);
                            sendTx.ins[i].script = script;
                        }
                        var data = 'tx=' + Crypto.util.bytesToHex(sendTx.serialize());
                        return ajax.post('https://blockchain.info/pushtx', data);
                    }
                }, function () {
                    reject(Error('Insufficient funds'));
                }).then(function () {
                    balanceListener(balance - amount - fee);
                    resolve();
                }, function () {
                    reject(Error('Unknown error'));
                });
            } else {
                reject(Error('Incorrect password'));
            }
        });
    };

    wallet.prototype.deleteAddress = function (password) {
        return new Promise(function (resolve, reject) {
            if (ret.validatePassword(password)) {
                if (websocket) {
                    websocket.close();
                    websocket = null;
                }
                balance = 0;
                address = '';
                privateKey = '';
                isEncrypted = false;
                Promise.all([preferences.setAddress(''), preferences.setPrivateKey('')]).then(function () {
                    resolve();
                });
            } else {
                reject(Error('Incorrect password'));
            }
        });
    };

    window.wallet = ret;
})(window);