var utils = (() => {

    "use strict";

    let debug_mode = false;
    let translationMap;
    let locale;
    let memoryStorage = new Map();

    const is_debug = () => {
        return debug_mode === true;
    };

    const enable_debug = (enable) => {
        debug_mode = enable === true;
    };

    const debug = (obj) => {
        if (debug_mode === true) {
            if (typeof obj === "string") {
                const dt = new Date();
                const time = utils.format_time(dt);
                const ms = dt.getMilliseconds().toString().padStart(3, 0);
                console.log(`${time}:${ms} ${obj}`);
            }
            else {
                console.log(obj);
            }
        }
    };

    const concat_strings = (arr, delim) => {
        let str = "";
        let idx = 0;
        arr.forEach((a) => {
            if (a && a.length > 0) {
                if (idx > 0) {
                    str += delim;
                }
                str += a;
                idx++;
            }
        });
        return str;
    };

    const format_date = (dt, options, mode) => {
        let d;
        if (typeof dt === "string" && dt.length > 0) {
            d = new Date(dt);
        }
        else if (typeof dt === "object") {
            d = dt;
        }
        if (d) {
            if (mode === "time") {
                return d.toLocaleTimeString(get_locale(), options);
            }
            if (mode === "string") {
                return d.toLocaleString(get_locale(), options);
            }
            return d.toLocaleDateString(get_locale(), options);
        }
        return "";
    };

    const format_date_string = (dt, options) => {
        return format_date(dt, options, "string");
    };

    const format_time = (dt, options) => {
        return format_date(dt, options, "time");
    };

    const format_size = (cnt) => {
        if (cnt >= 1024 * 1024) {
            return `${Math.floor(cnt / (1024 * 1024))} MB`;
        }
        if (cnt >= 1024) {
            return `${Math.floor(cnt / 1024)} KB`;
        }
        return `${cnt} B`;
    };

    const shuffle_array = (arr) => {
        let ridx;
        let tmp;
        let cidx = arr.length;
        while (0 !== cidx) {
            ridx = Math.floor(Math.random() * cidx);
            cidx -= 1;
            tmp = arr[cidx];
            arr[cidx] = arr[ridx];
            arr[ridx] = tmp;
        }
        return arr;
    };

    const count_characters = (txt, charset) => {
        let cnt = 0;
        for (let idx = 0; idx < txt.length; idx++) {
            cnt += charset.includes(txt[idx]) ? 1 : 0;
        }
        return cnt;
    };

    // --- mobile support

    const is_mobile = () => {
        return window.matchMedia('(max-width: 480px)').matches;
    };

    // --- pwdman

    const get_session_storage = (key) => {
        try {
            return window.sessionStorage.getItem(key);
        }
        catch (e) {
            return memoryStorage.get(key);
        }
    };

    const set_session_storage = (key, val) => {
        try {
            window.sessionStorage.setItem(key, val);
        }
        catch (e) {
            memoryStorage.set(key, val);
        }
    };

    const get_local_storage = (key) => {
        try {
            return window.localStorage.getItem(key);
        }
        catch (e) {
            return undefined;
        }
    };

    const set_local_storage = (key, val) => {
        try {
            window.localStorage.setItem(key, val);
        }
        catch (e) {
        }
    };

    const remove_local_storage = (key) => {
        try {
            window.localStorage.removeItem(key);
        }
        catch (e) {
        }
    };

    const remove_session_storage = (key) => {
        try {
            window.sessionStorage.removeItem(key);
        }
        catch (e) {
            memoryStorage.delete(key);
        }
    };

    const get_authentication_token = () => {
        let pwdmanState;
        let str = get_session_storage("pwdman-state");
        if (str && str.length > 0) {
            pwdmanState = JSON.parse(str);
            if (pwdmanState && !pwdmanState.requiresPass2 && pwdmanState.token.length > 0) {
                return pwdmanState.token;
            }
        }
        return undefined;
    };

    const is_pin_required = () => {
        return get_session_storage("pin-required") === "true";
    };

    const set_pin_required = (required) => {
        if (!required) {
            remove_session_storage("pin-required");
        }
        else {
            set_session_storage("pin-required", "true");
        }
    };

    const logout = (resolve, reject) => {
        const token = get_authentication_token();
        window.sessionStorage.clear();
        remove_local_storage("pwdman-lltoken");
        if (token) {
            fetch_api_call("api/pwdman/logout", { headers: { "token": token } },
                (done) => console.log(`User logout: ${done}.`),
                (errMsg) => console.error(`User logout failed: ${_T(errMsg)}`));
        }
        logout_skat(resolve, reject);
    };

    const logout_skat = (resolve, reject) => {
        let skatTicket = get_session_storage("skatticket");
        if (!skatTicket) {
            skatTicket = get_local_storage("skatticket");
        }
        if (skatTicket) {
            remove_session_storage("skatticket");
            remove_local_storage("skatticket");
            fetch_api_call("api/skat/logout", { method: "POST", headers: { "ticket": skatTicket } }, resolve, reject);
        }
        else {
            if (resolve) resolve();
        }
    };

    const fetch_api_call = (apicall, init, resolve, reject, set_waitcursor, retry) => {
        if (set_waitcursor) set_waitcursor(true);
        fetch(apicall, init)
            .then(response => {
                response.json()
                    .then(json => {
                        if (response.ok) {
                            if (set_waitcursor) set_waitcursor(false);
                            if (resolve) resolve(json);
                        }
                        else {
                            if (set_waitcursor) set_waitcursor(false);
                            if (!retry && json.status === 401) {
                                const token = get_authentication_token();
                                if (token) {
                                    window.sessionStorage.clear();
                                    if (init && init.headers && init.headers.token) {
                                        auth_lltoken(() => {
                                            const newtoken = get_authentication_token();
                                            if (newtoken && token != newtoken) {
                                                init.headers.token = newtoken;
                                                fetch_api_call(apicall, init, resolve, reject, set_waitcursor, true);
                                                return;
                                            }
                                            console.error(json);
                                            if (reject) reject(json.title);
                                        });
                                        return;
                                    }
                                }
                            }
                            console.error(json);
                            if (reject) reject(json.title);
                        }
                    })
                    .catch((err) => {
                        if (set_waitcursor) set_waitcursor(false);
                        console.error(err);
                        let errmsg = (response.status != 200) ? `${response.status} : ${response.statusText}` : err.message;
                        if (reject) reject(errmsg);
                    });
            })
            .catch(err => {
                if (set_waitcursor) set_waitcursor(false);
                console.error(err);
                if (reject) reject(err.message);
            });
    };

    const auth_lltoken = (resolve) => {
        let token = get_authentication_token();
        if (!token && !is_pin_required()) {
            let lltoken = get_local_storage("pwdman-lltoken");
            if (lltoken) {
                fetch_api_call("api/pwdman/auth/lltoken", { headers: { "token": lltoken } },
                    (authResult) => {
                        if (!authResult.requiresPin) {
                            const state = {
                                "token": authResult.token,
                                "userName": authResult.username,
                                "requiresPass2": authResult.requiresPass2
                            };
                            set_session_storage("pwdman-state", JSON.stringify(state));
                            set_local_storage("pwdman-lltoken", authResult.longLivedToken);
                            resolve();
                        }
                        else {
                            set_pin_required(true);
                            set_window_location("/pwdman?nexturl=" + encodeURI(get_window_location()));
                        }
                    },
                    (errmsg) => {
                        console.error(errmsg);
                        remove_local_storage("pwdman-lltoken");
                        resolve();
                    });
                return;
            }
        }
        resolve();
    };

    const verify_password_strength = (pwd) => {
        if (pwd.length >= 8) {
            let cntSymbols = count_characters(pwd, "!@$()=+-,:.");
            let cntUpper = count_characters(pwd, "ABCDEFGHIJKLMNOPQRSTUVWXYZ");
            let cntLower = count_characters(pwd, "abcdefghijklmnopqrstuvwxyz");
            let cntDigits = count_characters(pwd, "0123456789");
            return cntSymbols > 0 && cntUpper > 0 && cntLower > 0 && cntDigits > 0;
        }
        return false;
    };

    // --- encryption / decryption

    const hex2arr = (str) => {
        let ret = [];
        let l = str.length;
        for (let idx = 0; idx < l; idx += 2) {
            let h = str.substr(idx, 2);
            ret.push(parseInt(h, 16));
        }
        return ret;
    };

    const buf2hex = (buffer) => {
        let arr = new Uint8Array(buffer);
        return Array.prototype.map.call(arr, x => ("00" + x.toString(16)).slice(-2)).join("");
    };

    const create_crypto_key = (key, salt, resolve, reject) => {
        const encoded = new TextEncoder().encode(key);
        window.crypto.subtle.importKey("raw", encoded, "PBKDF2", false, ["deriveKey"])
            .then(pwdCryptoKey => {
                const algo = {
                    "name": "PBKDF2",
                    "hash": "SHA-256",
                    "salt": new TextEncoder().encode(salt),
                    "iterations": 1000
                };
                window.crypto.subtle.deriveKey(algo, pwdCryptoKey, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"])
                    .then(cryptoKey => resolve(cryptoKey))
                    .catch(err => reject(err.message));
            })
            .catch(err => reject(err.message));
    };

    const decode_message = (cryptoKey, msg, resolve, reject) => {
        let iv = hex2arr(msg.substr(0, 12 * 2));
        let data = hex2arr(msg.substr(12 * 2));
        let options = { name: "AES-GCM", iv: new Uint8Array(iv) };
        let cipherbuffer = new ArrayBuffer(data.length);
        let cipherarr = new Uint8Array(cipherbuffer);
        cipherarr.set(data);
        window.crypto.subtle.decrypt(options, cryptoKey, cipherbuffer)
            .then(decrypted => resolve(new TextDecoder().decode(decrypted)))
            .catch(err => reject(err.message));
    };

    const encode_message = (cryptoKey, msg, resolve, reject) => {
        let arr = new TextEncoder().encode(msg);
        let iv = window.crypto.getRandomValues(new Uint8Array(12));
        let options = { name: "AES-GCM", iv: iv };
        window.crypto.subtle.encrypt(options, cryptoKey, arr)
            .then(cipherText => resolve(buf2hex(iv) + buf2hex(cipherText)))
            .catch(err => reject(err.message));
    };

    const migrate_diary_encryption_key = (user, storageKey) => {
        const encryptKey = get_local_storage(`diary-${user.email}-encryptkey`);
        if (encryptKey && encryptKey.length > 0) {
            set_local_storage(storageKey, encryptKey);
            const viewed = get_local_storage(`diary-${user.email}-viewed-encryptkey`);
            if (viewed && viewed == "true") {
                set_viewed_encryption_key(user, true);
            }
            remove_local_storage(`diary-${user.email}-encryptkey`);
            remove_local_storage(`diary-${user.email}-viewed-encryptkey`);
            return encryptKey;
        }
        return undefined;
    };

    const has_viewed_encryption_key = (user) => {
        if (user) {
            let storageKey = `encryptkey-${user.id}-viewed`;
            let viewed = get_local_storage(storageKey);
            if (!viewed) {
                viewed = get_session_storage(storageKey);
            }
            return viewed && viewed == "true";
        }
        return false;
    };

    const set_viewed_encryption_key = (user, viewed) => {
        if (user) {
            let storageKey = `encryptkey-${user.id}-viewed`;
            if (viewed) {
                set_local_storage(storageKey, "true");
                set_session_storage(storageKey, "true");
            }
            else {
                remove_local_storage(storageKey);
                remove_session_storage(storageKey);
            }
        }
    };

    const generate_encryption_key = (len) => {
        let chars = "!@$()=+-,:.ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
        let arr = new Uint32Array(len);
        window.crypto.getRandomValues(arr);
        let encryptKey = "";
        for (let i = 0; i < arr.length; i++) {
            let idx = (arr[i] % chars.length);
            encryptKey += chars[idx];
        }
        return encryptKey;
    };

    // --- drop down menu

    const create_menu = (parent) => {
        if (!parent) {
            parent = document.body;
        }        
        const dropdownDiv = controls.create(parent, "div", "dropdown");
        dropdownDiv.id = "div-dropdown-id";
        const dropdownButton = controls.createImg(dropdownDiv, "dropbtn", 24, 24, "/images/buttons/hamburger.svg", _T("BUTTON_MENU"));
        const dropdownContentDiv = controls.create(dropdownDiv, "div", "dropdown-content");
        dropdownContentDiv.id = "dropdown-id";
        dropdownButton.addEventListener("click", () => document.getElementById("dropdown-id").classList.toggle("show"));
    };

    const set_menu_items = (currentUser) => {
        const parent = document.getElementById("dropdown-id");
        if (!parent) return;
        const small_height = window.matchMedia('(max-height: 450px)').matches;
        controls.removeAllChildren(parent);
        controls.createA(parent, undefined, "/view", _T("MENU_START"));
        if (!small_height) {
            controls.create(parent, "hr");
            controls.createA(parent, undefined, "/documents", _T("MENU_DOCUMENTS"));
            controls.createA(parent, undefined, "/password", _T("MENU_PASSWORDS"));
            controls.createA(parent, undefined, "/contacts", _T("MENU_CONTACTS"));
            controls.createA(parent, undefined, "/notes", _T("MENU_NOTES"));
            controls.createA(parent, undefined, "/diary", _T("MENU_DIARY"));
            controls.create(parent, "hr");
            controls.createA(parent, undefined, "/backgammon", _T("MENU_BACKGAMMON"));
            controls.createA(parent, undefined, "/chess", _T("MENU_CHESS"));
            controls.createA(parent, undefined, "/skat", _T("MENU_SKAT"));
            controls.createA(parent, undefined, "/tetris", _T("MENU_TETRIS"));
        }
        controls.create(parent, "hr");
        if (currentUser) {
            controls.createA(parent, undefined, "/usermgmt", _T("MENU_PROFILE"));
            controls.createA(parent, undefined, "/usermgmt?logout", _T("MENU_LOGOUT"));
        }
        else {
            controls.createA(parent, undefined, "/pwdman?nexturl=/view", _T("MENU_LOGIN"));
        }
        const encryptKeyElem = document.getElementById("div-encryptkey-id");
        if (encryptKeyElem) {
            if (encryptKeyElem.classList.contains("show")) {
                controls.createA(parent, undefined, "/hidekey", _T("MENU_HIDE_KEY"),
                    () => {
                        set_viewed_encryption_key(currentUser, true);
                        show_encrypt_key(currentUser, false);
                    });
            }
            else {
                controls.createA(parent, undefined, "/showkey", _T("MENU_SHOW_KEY"),
                    () => show_encrypt_key(currentUser, true));
            }
        }
    };

    const show_encrypt_key = (currentUser, show) => {
        const encryptKeyElem = document.getElementById("div-encryptkey-id");
        if (!encryptKeyElem) return;
        if (show || !has_viewed_encryption_key(currentUser)) {
            encryptKeyElem.classList.add("show");
        }
        else {
            encryptKeyElem.classList.remove("show");
        }
        set_menu_items(currentUser);
    };

    const hide_menu = (event) => {
        if (!event.target.matches(".dropbtn")) {
            const dropdowns = document.getElementsByClassName("dropdown-content");
            if (dropdowns) {
                for (let i = 0; i < dropdowns.length; i++) {
                    let openDropdown = dropdowns[i];
                    if (openDropdown.classList.contains("show")) {
                        openDropdown.classList.remove("show");
                    }
                }
            }
        }
    };

    const is_menu_hidden = () => {
        const dropdowns = document.getElementsByClassName("dropdown-content");
        if (dropdowns) {
            for (let i = 0; i < dropdowns.length; i++) {
                let openDropdown = dropdowns[i];
                if (openDropdown.classList.contains("show")) {
                    return false;
                }
            }
        }
        return true;
    };


    // --- cookies

    const is_cookies_accepted = () => {
        const key = "cookies-accepted";
        let accepted = get_session_storage(key);
        if (!accepted) {
            accepted = get_local_storage(key);
        }
        return accepted && accepted == "true";
    };

    const set_cookies_accepted = (accepted) => {
        const key = "cookies-accepted";
        if (accepted) {
            set_session_storage(key, "true");
            set_local_storage(key, "true");
        }
        else {
            remove_session_storage(key);
            remove_local_storage(key);
        }
    };

    const has_session_storage = () => {
        try {
            const key = "has_session_storage";
            window.sessionStorage.setItem(key, "1");
            if (window.sessionStorage.getItem(key) == "1") {
                window.sessionStorage.removeItem(key);
                return true;
            }
        }
        catch (e) {
        }
        return false;
    };

    const create_cookies_banner = (parent) => {
        if (!is_cookies_accepted()) {
            const cookieDiv = controls.createDiv(parent, "cookie-banner");
            const spanDiv = controls.createDiv(cookieDiv, "cookie-container");
            if (!has_session_storage()) {
                controls.createSpan(spanDiv, undefined, _T("INFO_WEBSITE_USE_COOKIES_BUT_CANNOT_READ_SAVE"));
            }
            else {
                controls.createSpan(spanDiv, undefined, _T("INFO_WEBSITE_USE_COOKIES"));
            }
            const linkDiv = controls.createDiv(cookieDiv, "cookie-container");
            controls.createA(linkDiv, undefined, "/view?page=cookies&hidecookiebanner", _T("INFO_QUESTION_MORE_INFO"));
            const btnDiv = controls.createDiv(cookieDiv, "cookie-container");
            controls.createButton(btnDiv, _T("BUTTON_OK"), () => {
                set_cookies_accepted(true);
                cookieDiv.style.display = "none";
            }, "", "button");
        }
    };

    // --- locale

    const get_locale = () => {
        if (!locale) {
            locale = get_local_storage("locale");
            if (!locale) {
                locale = get_session_storage("locale");
                if (!locale) {
                    locale = navigator.language;
                    set_session_storage("locale", locale);
                    set_local_storage("locale", locale);
                }
            }
        }
        return locale;
    };

    const init_locale = (resolve, url, loc) => {
        translationMap = new Map();
        fetch(url)
            .then(resp => {
                resp.json()
                    .then(json => {
                        Object.entries(json).forEach(([key, value]) => translationMap.set(key, value));
                        locale = loc;
                        set_session_storage("locale", locale);
                        set_local_storage("locale", locale);
                        resolve();
                    })
                    .catch(err => {
                        console.log(err);
                        resolve();
                    });
            })
            .catch(err => {
                console.log(err);
                resolve();
            });
    };

    const set_locale = (resolve, loc) => {
        if (!loc) {
            loc = get_locale();
        }
        fetch_api_call(`api/pwdman/locale/url/${loc}`, undefined,
            (url) => init_locale(resolve, url, loc),
            (errMsg) => {
                console.error(errMsg);
                resolve();
            });
    };

    const translate = (id) => {
        if (translationMap && translationMap.has(id)) {
            return translationMap.get(id);
        }
        return id;
    };

    const format = (s, arr) => {
        for (let i = 0; i < arr.length; i++) {
            const reg = new RegExp("\\{" + i + "\\}", "gm");
            s = s.replace(reg, arr[i]);
        }
        return s;
    };

    // --- sanitize window location change

    const sanitize_location = (url) => {
        let idx = -1;
        if (url && url.length > 0) {
            if (url.charAt(0) != "/") {
                idx = url.indexOf("//");
                if (idx >= 0) {
                    url = url.substr(idx + 2);
                    idx = url.indexOf("/");
                    if (idx > 0) {
                        url = url.substr(idx);
                    }
                }
            }
            if (url.charAt(0) == "/") {
                let testurl = url;
                idx = testurl.indexOf("?");
                if (idx > 0) {
                    testurl = testurl.substr(0, idx);
                }
                const validurls = [
                    "/backgammon", "/chess", "/contacts", "/diary", "/documents", "/notes", "/password",
                    "/pwdman", "/skat", "/skatticket", "/slideshow", "/tetris", "/usermgmt", "/view"];
                if (validurls.includes(testurl)) {
                    return url;
                }
            }
        }
        return "/view";
    };

    const get_window_location = () => sanitize_location(window.location.href);

    const set_window_location = (url) => window.location.href = sanitize_location(url);

    const replace_window_location = (url) => window.location.replace(sanitize_location(url));

    // --- async crypto and secure storage functions

    const create_crypto_key_async = async (key, salt) => {
        const pwdCryptoKey = await window.crypto.subtle.importKey("raw", new TextEncoder().encode(key), "PBKDF2", false, ["deriveKey"]);
        const algo = {
            "name": "PBKDF2",
            "hash": "SHA-256",
            "salt": new TextEncoder().encode(salt),
            "iterations": 1000
        };
        return await window.crypto.subtle.deriveKey(algo, pwdCryptoKey, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
    };

    const decode_message_async = async (cryptoKey, msg) => {
        const iv = hex2arr(msg.substr(0, 12 * 2));
        const data = hex2arr(msg.substr(12 * 2));
        const options = { name: "AES-GCM", iv: new Uint8Array(iv) };
        const cipherbuffer = new ArrayBuffer(data.length);
        const cipherarr = new Uint8Array(cipherbuffer);
        cipherarr.set(data);
        const decrypted = await window.crypto.subtle.decrypt(options, cryptoKey, cipherbuffer);
        return new TextDecoder().decode(decrypted);
    };

    const encode_message_async = async (cryptoKey, msg) => {
        const arr = new TextEncoder().encode(msg);
        const iv = window.crypto.getRandomValues(new Uint8Array(12));
        const options = { name: "AES-GCM", iv: iv };
        const cipherText = await window.crypto.subtle.encrypt(options, cryptoKey, arr);
        return buf2hex(iv) + buf2hex(cipherText);
    };

    const decode_seckey_async = async (secKey, msg) => {
        const rawKey = new Uint8Array(hex2arr(secKey));
        const cryptoKey = await window.crypto.subtle.importKey("raw", rawKey, { name: "AES-GCM", length: 256 }, false, ["decrypt"]);
        return await decode_message_async(cryptoKey, msg);
    };

    const encode_seckey_async = async (secKey, msg) => {
        const rawKey = new Uint8Array(hex2arr(secKey));
        const cryptoKey = await window.crypto.subtle.importKey("raw", rawKey, { name: "AES-GCM", length: 256 }, false, ["encrypt"]);
        return await encode_message_async(cryptoKey, msg);
    };

    const get_secure_local_storage_key = (user, key) => `${key}-${user.id}-secure`;

    const get_secure_local_storage_async = async (user, key) => {
        let secureValue;
        if (user && key) {
            const storageKey = get_secure_local_storage_key(user, key);
            secureValue = get_local_storage(storageKey);
            if (secureValue) {
                try {
                    secureValue = await decode_seckey_async(user.secKey, secureValue);
                }
                catch (e) {
                    console.error(e);
                    try {
                        const cryptoKey = await create_crypto_key_async(storageKey, user.passwordManagerSalt);
                        secureValue = await decode_message_async(cryptoKey, secureValue);
                        await set_secure_local_storage_async(user, key, secureValue);
                    }
                    catch (e) {
                        console.error(e);
                        secureValue = undefined;
                    }
                }
            }
        }
        return secureValue;
    };

    const set_secure_local_storage_async = async (user, key, val) => {
        if (user && user.secKey && key && val) {
            const storageKey = get_secure_local_storage_key(user, key);
            try {
                const secureValue = await encode_seckey_async(user.secKey, val);
                if (secureValue) {
                    set_local_storage(storageKey, secureValue);
                }
            }
            catch (e) {
                console.error(e);
                remove_local_storage(storageKey);
            }
        }
    };

    const remove_secure_local_storage = (user, key) => {        
        remove_local_storage(get_secure_local_storage_key(user, key));
    };

    const get_encryption_key_async = async (user) => {
        if (user) {
            const storageKey = "encryptkey";
            const sessionKey = `${storageKey}-${user.id}`;
            let encryptKey = get_session_storage(sessionKey);
            if (!encryptKey) {
                encryptKey = await get_secure_local_storage_async(user, storageKey);
                if (encryptKey) {
                    set_session_storage(sessionKey, encryptKey);
                }
            }
            if (encryptKey && encryptKey.length > 0) {
                return encryptKey;
            }
            return await migrate_encryption_key_async(user);
        }
        return undefined;
    };

    const set_encryption_key_async = async (user, encryptKey) => {
        if (user) {
            const storageKey = "encryptkey";
            const sessionKey = `${storageKey}-${user.id}`;
            if (encryptKey && encryptKey.length > 0) {
                set_session_storage(sessionKey, encryptKey);
                await set_secure_local_storage_async(user, storageKey, encryptKey);
            }
            else {
                remove_session_storage(sessionKey);
                remove_secure_local_storage(user, storageKey);
            }
        }
    };

    const migrate_encryption_key_async = async (user) => {
        const storageKey = "encryptkey";
        const oldStorageKey = `encryptkey-${user.id}`;
        migrate_diary_encryption_key(user, oldStorageKey);
        const encryptKey = get_local_storage(oldStorageKey);
        if (encryptKey && encryptKey.length > 0) {
            remove_local_storage(oldStorageKey);
            await set_secure_local_storage_async(user, storageKey, encryptKey);
            return encryptKey;
        }
        return undefined;
    };

    // --- public API

    return {
        concat_strings: concat_strings,
        format_date: format_date,
        format_date_string: format_date_string,
        format_time: format_time,
        format_size: format_size,
        shuffle_array: shuffle_array,
        count_characters: count_characters,
        get_authentication_token: get_authentication_token,
        logout: logout,
        logout_skat: logout_skat,
        fetch_api_call: fetch_api_call,
        is_mobile: is_mobile,
        auth_lltoken: auth_lltoken,
        verify_password_strength: verify_password_strength,
        hex2arr: hex2arr,
        buf2hex: buf2hex,
        create_crypto_key: create_crypto_key,
        decode_message: decode_message,
        encode_message: encode_message,
        has_viewed_encryption_key: has_viewed_encryption_key,
        set_viewed_encryption_key: set_viewed_encryption_key,
        generate_encryption_key: generate_encryption_key,
        create_menu: create_menu,
        set_menu_items: set_menu_items,
        show_encrypt_key: show_encrypt_key,
        hide_menu: hide_menu,
        is_menu_hidden: is_menu_hidden,
        is_cookies_accepted: is_cookies_accepted,
        set_cookies_accepted: set_cookies_accepted,
        create_cookies_banner: create_cookies_banner,
        is_debug: is_debug,
        enable_debug: enable_debug,
        debug: debug,
        set_locale: set_locale,
        get_locale: get_locale,
        translate: translate,
        format: format,
        get_session_storage: get_session_storage,
        get_local_storage: get_local_storage,
        set_session_storage: set_session_storage,
        set_local_storage: set_local_storage,
        remove_local_storage: remove_local_storage,
        remove_session_storage: remove_session_storage,
        get_window_location: get_window_location,
        set_window_location: set_window_location,
        replace_window_location: replace_window_location,
        get_secure_local_storage_async: get_secure_local_storage_async,
        set_secure_local_storage_async: set_secure_local_storage_async,
        remove_secure_local_storage: remove_secure_local_storage,
        get_encryption_key_async: get_encryption_key_async,
        set_encryption_key_async: set_encryption_key_async,
        is_pin_required: is_pin_required,
        set_pin_required: set_pin_required
    };
})();

function _T(id, ...restArgs) {
    const arr = id.split(":");
    if (arr.length > 1) {
        return utils.format(utils.translate(arr[0]), arr.slice(1));
    }
    return utils.format(utils.translate(id), restArgs);
}