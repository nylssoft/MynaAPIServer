"use strict";

var pwdman = (() => {

    // UI elements

    let userPasswordPwd;
    let userNameInput;
    let codeInput;
    let filterInput;
    let secretKeyPwd;
    let oldPasswordPwd;
    let newPasswordPwd;
    let confirmPasswordPwd;
    let errorDiv;
    let pwdItemsDiv;

    // state

    let userName;
    let token;
    let requiresPass2;
    let salt
    let cryptoKey;
    let changePwd;
    let lastErrorMessage;

    let version = "1.0.4";

    // helper

    const hex2arr = (str) => {
        let ret = [];
        let l = str.length;
        for (let idx = 0; idx < l; idx += 2) {
            let h = str.substr(idx, 2);
            ret.push(parseInt(h, 16));
        }
        return ret;
    };

    const getHostFromUrl = (urlstr) => {
        urlstr = urlstr.toLowerCase();
        if (!urlstr.startsWith("http:") && !urlstr.startsWith("https:")) {
            urlstr = `https://${urlstr}`;
        }
        return new URL(urlstr).host;
    };

    const getState = () => {
        let ret;
        let str = window.sessionStorage.getItem("pwdman-state");
        if (str && str.length > 0) {
            ret = JSON.parse(str);
        }
        return ret;
    };

    const setState = (state) => {
        if (state) {
            window.sessionStorage.setItem("pwdman-state", JSON.stringify(state));
        }
        else {
            window.sessionStorage.removeItem("pwdman-state");
        }
    };

    const reset = (errmsg) => {
        setState();
        token = undefined;
        cryptoKey = undefined;
        userName = undefined;
        changePwd = false;
        lastErrorMessage = "";
        if (errmsg) {
            lastErrorMessage = errmsg;
        }
        render();
    };

    const authenticate = () => {
        lastErrorMessage = "";
        fetch("api/pwdman/auth", {
            method: "POST",
            headers: { "Accept": "application/json", "Content-Type": "application/json" },
            body: JSON.stringify({ "username": userNameInput.value, "password": userPasswordPwd.value })
        })
            .then(response => {
                if (response.ok) {
                    response.json().then(authResult => {
                        userName = userNameInput.value;
                        token = authResult.token;
                        requiresPass2 = authResult.requiresPass2;
                        setState({ "token": token, "userName": userName, "requiresPass2": requiresPass2 });
                        render();
                    });
                }
                else {
                    response.json().then(apierr => {
                        lastErrorMessage = apierr.title;
                        render();
                    })
                }
            })            
            .catch(err => {
                lastErrorMessage = err.message;
                render();
            });
    };

    const authenticatePass2 = () => {
        lastErrorMessage = "";
        fetch("api/pwdman/auth2", {
            method: "POST",
            headers: { "Accept": "application/json", "Content-Type": "application/json", "token": token },
            body: JSON.stringify(codeInput.value.trim())
        })
            .then(response => {
                if (response.ok) {
                    response.json().then(t => {
                        token = t;
                        requiresPass2 = false;
                        let state = getState();
                        state.token = token;
                        state.requiresPass2 = requiresPass2;
                        setState(state);
                        render();
                    });
                }
                else {
                    response.json().then(apierr => {
                        lastErrorMessage = apierr.title;
                        render();
                    })
                }
            })
            .catch(err => {
                lastErrorMessage = err.message;
                render();
            });
    };

    const resendTOTP = () => {
        lastErrorMessage = "";
        fetch("api/pwdman/totp", {
            method: "POST",
            headers: { "Accept": "application/json", "Content-Type": "application/json", "token": token }
        })
            .then(response => {
                if (response.ok) {
                    render();
                }
                else {
                    response.json().then(apierror => {
                        lastErrorMessage = apierror.title;
                        render();
                    });
                }
            })
            .catch(err => {
                lastErrorMessage = err.message;
                render();
            });
    };

    const changePassword = () => {
        if (newPasswordPwd.value != confirmPasswordPwd.value) {
            errorDiv.textContent = "Die Best\u00E4tigung passt nicht mit dem Kennwort \u00FCberein.";
            return;
        }
        lastErrorMessage = "";
        fetch("api/pwdman/userpwd", {
            method: "POST",
            headers: { "Accept": "application/json", "Content-Type": "application/json", "token": token },
            body: JSON.stringify({ "oldpassword": oldPasswordPwd.value, "newpassword": newPasswordPwd.value })
        })
            .then(response => {
                if (response.ok) {
                    changePwd = false;
                    render();
                }
                else {
                    response.json().then(apierror => {
                        lastErrorMessage = apierror.title;
                        render();
                    });
                }
            })
            .catch(err => {
                lastErrorMessage = err.message;
                render();
            });
    };

    const cancelChangePwd = () => {
        lastErrorMessage = "";
        changePwd = false;
        render();
    };

    const setCryptoKey = () => {
        let encoded = new TextEncoder().encode(secretKeyPwd.value);
        crypto.subtle.importKey("raw", encoded, "PBKDF2", false, ["deriveKey"])
            .then(key => {
                let algo = {
                    name: "PBKDF2",
                    hash: "SHA-256",
                    salt: new TextEncoder().encode(salt),
                    iterations: 1000
                };
                crypto.subtle.deriveKey(algo, key, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"])
                    .then(c => {
                        cryptoKey = c;
                        render();
                    })
                    .catch(err => console.error(err));
            })
            .catch(err => console.error(err));
    };

    const filterItems = (pwdItems) => {
        let v = filterInput.value.toLowerCase();
        if (v.length > 0) {
            let filteredItems = [];
            pwdItems.forEach(pwdItem => {
                if (pwdItem.Name.toLowerCase().startsWith(v)) {
                    filteredItems.push(pwdItem);
                }
            });
            renderPasswordTable(pwdItemsDiv, filteredItems);
        }
        else {
            renderPasswordTable(pwdItemsDiv, pwdItems);
        }
    };

    const decodePassword = async (encodedPwd) => {
        let iv = hex2arr(encodedPwd.substr(0, 12 * 2));
        let data = hex2arr(encodedPwd.substr(12 * 2));
        let options = { name: "AES-GCM", iv: new Uint8Array(iv) };
        let cipherbuffer = new ArrayBuffer(data.length);
        let cipherarr = new Uint8Array(cipherbuffer);
        cipherarr.set(data);
        let decrypted = await crypto.subtle.decrypt(options, cryptoKey, cipherbuffer);
        return new TextDecoder().decode(decrypted);
    };

    // rendering

    const renderError = (parent) => {
        errorDiv = controls.createDiv(parent, "error");
        if (lastErrorMessage) {
            errorDiv.textContent = lastErrorMessage;
        }
    };

    const renderCopyright = (parent) => {
        let div = controls.createDiv(parent);
        controls.create(div, "span", "copyright", `Myna Password Reader ${version}. Copyright 2020 `);
        let a = controls.createA(div, "copyright", "https://github.com/nylssoft/", "Niels Stockfleth");
        a.target = "_blank";
        controls.create(div, "span", "copyright", `. Alle Rechte vorbehalten.`);
        if (token) {
            let logoutDiv = controls.createDiv(parent);
            controls.createButton(logoutDiv, "Abmelden", btnLogout_click, undefined, "small-button");
            if (!changePwd) {
                controls.createButton(logoutDiv, "Kennwort \u00E4ndern", btnChangePwd_click, undefined, "small-button");
            }
        }
    };

    const renderAuthentication = (parent) => {
        controls.create(parent, "h1", undefined, "Anmelden");
        controls.create(parent, "p", undefined, "Melde Dich mit Benutzernamen und Passwort an.");
        let loginDiv = controls.createDiv(parent);
        let userNameLabel = controls.createLabel(loginDiv, undefined, "Benutzer:");
        userNameLabel.htmlFor = "username-id";
        userNameInput = controls.createInputField(loginDiv, "Benutzer", () => userPasswordPwd.focus(), undefined, 16, 20);
        userNameInput.id = "username-id";
        let passwordDiv = controls.createDiv(parent);
        let userPasswordLabel = controls.createLabel(passwordDiv, undefined, "Kennwort:");
        userPasswordLabel.htmlFor = "userpwd-id";
        userPasswordPwd = controls.createPasswordField(passwordDiv, "Kennwort", authenticate, undefined, 16, 30);
        userPasswordPwd.id = "userpwd-id";
        let buttonDiv = controls.createDiv(parent);
        controls.createButton(buttonDiv, "Anmelden", authenticate, undefined, "button");
        renderError(parent);
    };

    const renderPass2 = (parent) => {
        controls.create(parent, "h1", undefined, "Anmelden");
        if (lastErrorMessage && lastErrorMessage.length > 0) {
            renderError(parent);
            let buttonResendDiv = controls.createDiv(parent);
            controls.createButton(buttonResendDiv, "Neuen Code anfordern", resendTOTP, undefined, "button");
        }
        else {
            controls.create(parent, "p", undefined, "Gib den Sicherheitsscode f\u00FCr die Zwei-Schritt-Verifizierung ein. " +
                "Der Code wurde per E-Mail an Dich gesendet. " +
                "Er ist nur eine begrenzte Zeit g\u00FCltig.");
            let codeDiv = controls.createDiv(parent);
            let codeLabel = controls.createLabel(codeDiv, undefined, "Sicherheitsscode:");
            codeLabel.htmlFor = "securitycode-id";
            codeInput = controls.createInputField(codeDiv, "Sicherheitsscode", authenticatePass2, undefined, 10, 10);
            codeInput.id = "securitycode-id";
            let buttonLoginDiv = controls.createDiv(parent);
            controls.createButton(buttonLoginDiv, "Anmelden", authenticatePass2, undefined, "button");
        }
    };

    const renderChangePwd = (parent) => {
        controls.create(parent, "h1", undefined, "Kennwort \u00E4ndern");
        controls.create(parent, "p", undefined, "Gib Dein altes und neues Kennwort ein.");
        let oldPwdDiv = controls.createDiv(parent);
        let oldPwdLabel = controls.createLabel(oldPwdDiv, undefined, "Altes Kennwort:");
        oldPwdLabel.htmlFor = "oldpwd-id";
        oldPasswordPwd = controls.createPasswordField(oldPwdDiv, "Altes Kennwort", () => newPasswordPwd.focus(), undefined, 16, 100);
        oldPasswordPwd.id = "oldpwd-id";
        let newPwdDiv = controls.createDiv(parent);
        let newPwdLabel = controls.createLabel(newPwdDiv, undefined, "Neues Kennwort:");
        newPwdLabel.htmlFor = "newpwd-id";
        newPasswordPwd = controls.createPasswordField(newPwdDiv, "Neues Kennwort", () => confirmPasswordPwd.focus(), undefined, 16, 100);
        newPasswordPwd.id = "newpwd-id";
        let confirmPwdDiv = controls.createDiv(parent);
        let confirmPwdLabel = controls.createLabel(confirmPwdDiv, undefined, "Best\u00E4tiges Kennwort:");
        confirmPwdLabel.htmlFor = "confirmpwd-id";
        confirmPasswordPwd = controls.createPasswordField(confirmPwdDiv, "Best\u00E4tiges Kennwort", undefined, undefined, 16, 100);
        confirmPasswordPwd.id = "confirmpwd-id";
        let okCancelDiv = controls.createDiv(parent);
        controls.createButton(okCancelDiv, "OK", changePassword, undefined, "button");
        controls.createButton(okCancelDiv, "Abbrechen", cancelChangePwd, undefined, "button");
        renderError(parent);
    };

    const renderSecretKey = (parent) => {
        controls.create(parent, "h1", undefined, "Passw\u00F6rter dekodieren");
        controls.create(parent, "p", undefined, "Gibt den Schl\u00FCssel zum Dekodieren der Passwortdatei ein.");
        let keyPwdDiv = controls.createDiv(parent);
        let keyPwdLabel = controls.createLabel(keyPwdDiv, undefined, "Schl\u00FCssel:");
        keyPwdLabel.htmlFor = "keypwd-id";
        secretKeyPwd = controls.createPasswordField(keyPwdDiv, "Schl\u00FCssel", setCryptoKey, undefined, 32, 100);
        secretKeyPwd.id = "keypwd-id";
        let buttonDecodeDiv = controls.createDiv(parent);
        controls.createButton(buttonDecodeDiv, "Dekodieren", setCryptoKey, undefined, "button");
        renderError(parent);
        renderCopyright(parent);
    };

    const renderPasswordItem = (parent, txt, desc, decode) => {
        if (txt.length == 0) return;
        let imgshow = controls.createImg(parent, undefined, 32, 32, "/images/pwdman/document-decrypt-3.png");
        imgshow.title = `${desc} anzeigen`;
        let imgcopy = controls.createImg(parent, undefined, 32, 32, "/images/pwdman/edit-copy-6.png");
        imgcopy.title = `${desc} in die Zwischenablage kopieren`;
        let span = controls.create(parent, "span", "pwditem");
        imgcopy.addEventListener("click", async () => {
            let t = txt;
            if (decode) {
                t = await decodePassword(txt);
            }
            navigator.clipboard.writeText(t);
        });
        imgshow.addEventListener("click", async () => {
            let hide = span.textContent.length > 0;
            if (hide) {
                span.textContent = "";
                imgshow.title = `${desc} anzeigen`;
                imgshow.src = "/images/pwdman/document-decrypt-3.png";
            }
            else {
                let t = txt;
                if (decode) {
                    t = await decodePassword(txt);
                }
                span.textContent = t;
                imgshow.title = `${desc} verbergen`;
                imgshow.src = "/images/pwdman/document-encrypt-3.png";
            }
        });
    };

    const renderPasswordItemDetails = (parent, pwdItems, pwdItem) => {
        controls.removeAllChildren(parent);
        controls.create(parent, "h1", undefined, "Passwort");
        let detailsNameDiv = controls.createDiv(parent);
        controls.createLabel(detailsNameDiv, "details-label", "Name:");
        if (pwdItem.Url.length > 0) {
            let host = getHostFromUrl(pwdItem.Url);
            controls.createImg(detailsNameDiv, "favicon", 16, 16, `https://www.google.com/s2/favicons?domain=${host}`);
            let url = pwdItem.Url;
            if (url.indexOf(":") == -1) {
                url = `https://${url}`;
            }
            controls.createA(detailsNameDiv, undefined, url, pwdItem.Name,
                () => window.open(url, "_blank", "noopener=yes,noreferrer=yes"));
        }
        else {
            controls.create(detailsNameDiv, "span", undefined, pwdItem.Name);
        }
        if (pwdItem.Login.length) {
            let detailsLoginDiv = controls.createDiv(parent);
            controls.createLabel(detailsLoginDiv, "details-label", "Login:");
            renderPasswordItem(detailsLoginDiv, pwdItem.Login, "Login");
        }
        let detailsPasswordDiv = controls.createDiv(parent);
        controls.createLabel(detailsPasswordDiv, "details-label", "Passwort:");
        renderPasswordItem(detailsPasswordDiv, pwdItem.Password, "Passwort", true);
        if (pwdItem.Description.length > 0) {
            let detailsDescriptionDiv = controls.createDiv(parent);
            controls.createLabel(detailsDescriptionDiv, "details-label", "Beschreibung:");
            renderPasswordItem(detailsDescriptionDiv, pwdItem.Description, "Beschreibung");
        }
        let buttonBackDiv = controls.createDiv(parent);
        controls.createButton(buttonBackDiv, "Zur\u00FCck zur Liste", () => {
            controls.removeAllChildren(parent);
            renderPasswordItems(parent, pwdItems);
        }, undefined, "button");
        renderCopyright(parent);
    };

    const renderPasswordTable = (parent, pwdItems) => {
        controls.removeAllChildren(parent);
        let table = controls.create(parent, "table");
        let tbody = controls.create(table, "tbody");
        pwdItems.forEach(pwdItem => {
            let tr = controls.create(tbody, "tr");
            let tdname = controls.create(tr, "td");
            if (pwdItem.Url.length > 0) {
                let host = getHostFromUrl(pwdItem.Url);
                controls.createImg(tdname, "favicon", 16, 16, `https://www.google.com/s2/favicons?domain=${host}`);
            }
            controls.createA(tdname, undefined, "#open", pwdItem.Name,
                () => renderPasswordItemDetails(document.body, pwdItems, pwdItem));
        });
    };

    const renderPasswordItems = (parent, pwdItems) => {
        controls.create(parent, "h1", undefined, "Passw\u00F6rter");
        controls.create(parent, "p", undefined, "Gib ein Suchbegriff ein, um die Liste zu verkleinern.");
        let filterDiv = controls.createDiv(parent);
        let searchLabel = controls.createLabel(filterDiv, undefined, "Suche:");
        searchLabel.htmlFor = "filter-id";
        filterInput = controls.createInputField(filterDiv, "Suche", undefined, undefined, 20, 32);
        filterInput.id = "filter-id";
        filterInput.addEventListener("input", () => filterItems(pwdItems));
        pwdItemsDiv = controls.createDiv(parent);
        renderPasswordTable(pwdItemsDiv, pwdItems);
        renderCopyright(parent);
    };

    const render = () => {
        controls.removeAllChildren(document.body);
        let state = getState();
        if (state) {
            if (requiresPass2 == undefined) {
                requiresPass2 = state.requiresPass2;
            }
            if (!token || token.length == 0) {
                token = state.token;
                userName = state.userName;
            }
        }
        if (!token || token.length == 0) {
            renderAuthentication(document.body);
        }
        else if (requiresPass2 == true) {
            renderPass2(document.body);
        }
        else if (changePwd) {
            renderChangePwd(document.body);
        }
        else if (cryptoKey === undefined) {
            fetch("api/pwdman/salt", { headers: { "token": token } })
                .then(response => {
                    if (response.ok) {
                        response.json().then(s => {
                            salt = s;
                            renderSecretKey(document.body, salt);
                        });
                    }
                    else {
                        response.json().then(apierr => reset(apierr.title));
                    }
                })
                .catch(err => reset(err.message));
        }
        else {
            lastErrorMessage = "";
            fetch("api/pwdman/file", { headers: { "token": token } })
                .then(response => {
                    if (response.ok) {
                        response.json().then(datastr => {
                            let iv = hex2arr(datastr.substr(0, 12 * 2));
                            let data = hex2arr(datastr.substr(12 * 2));
                            let options = { name: "AES-GCM", iv: new Uint8Array(iv) };
                            let cipherbuffer = new ArrayBuffer(data.length);
                            let cipherarr = new Uint8Array(cipherbuffer);
                            cipherarr.set(data);
                            crypto.subtle.decrypt(options, cryptoKey, cipherbuffer)
                                .then(decrypted => {
                                    let str = new TextDecoder().decode(decrypted);
                                    let pwdItems = JSON.parse(str);
                                    pwdItems.sort((a, b) => a.Name.localeCompare(b.Name));
                                    renderPasswordItems(document.body, pwdItems);
                                })
                                .catch(() => {
                                    lastErrorMessage = "Die Passwortdatei kann nicht entschl\u00FCsselt werden.";
                                    cryptoKey = undefined;
                                    render();
                                });
                        });
                    }
                    else {
                        response.json().then(apierr => reset(apierr.title));
                    }
                })
                .catch(err => reset(err.message));
        }
    };

    // callbacks

    const btnLogout_click = () => {
        reset();
    };

    const btnChangePwd_click = () => {
        lastErrorMessage = "";
        changePwd = true;
        render();
    };

    // --- public API

    return {
        render: render
    };
})();

window.onload = () => {
    pwdman.render();
};
