var contacts = (() => {

    "use strict";
    
    // state

    let version = "1.0.6";
    let cryptoKey;
    let currentUser;
    let helpDiv;
    let filterInput;
    let contactItemsDiv;
    let contactsData;
    let isChanged = false;
    let currentItem;
    let sortAttribute = "firstname";
    let sortUp = true;

    // helper

    const hasEncryptKey = () => {
        let elem = document.getElementById("input-encryptkey-id");
        return elem && elem.value.trim().length > 0;
    };

    const initCryptoKey = (resolve, reject) => {
        if (!cryptoKey) {
            let elem = document.getElementById("input-encryptkey-id");
            if (elem && elem.value.trim().length > 0) {
                utils.create_crypto_key(elem.value.trim(), currentUser.passwordManagerSalt,
                    (ck) => {
                        cryptoKey = ck;
                        resolve();
                    },
                    reject
                );
                return;
            }
        }
        resolve();
    };

    const encodeText = (text, resolve, reject) => {
        initCryptoKey(() => utils.encode_message(cryptoKey, text, resolve, reject), reject);
    };

    const decodeText = (text, resolve, reject) => {
        initCryptoKey(() => utils.decode_message(cryptoKey, text, resolve, reject), reject);
    };

    const getBirthdayNumber = (val) => {
        const arr = val.split(".");
        if (arr.length > 1) {
            const a = parseInt(arr[0]);
            const b = parseInt(arr[1]);
            if (!Number.isNaN(a) && !Number.isNaN(b)) {
                return b * 100 + a;
            }
        }
        return 0;
    };

    const sortItems = (items) => {
        const dir = sortUp ? 1 : -1;
        const sortFirstname = sortAttribute === "firstname";
        const sortBirthday = sortAttribute === "birthday";
        items.sort((a, b) => {
            let ret = 0;
            if (sortFirstname) {
                ret = a.name.localeCompare(b.name);
            }
            else if (sortBirthday) {
                ret = getBirthdayNumber(a.birthday) - getBirthdayNumber(b.birthday);
            }
            else {
                const arr1 = a.name.split(" ");
                const arr2 = b.name.split(" ");
                ret = arr1.length - arr2.length;
                if (ret === 0) {
                    ret = arr1[arr1.length - 1].localeCompare(arr2[arr2.length - 1]);
                    if (ret === 0 && arr1.length > 1 && arr2.length > 1) {
                        ret = arr1[0].localeCompare(arr2[0]);
                    }
                }
            }
            return ret * dir;
        });
    };

    const cloneData = (data) => {
        const newdata = { "nextId": data.nextId, "version": data.version, "items": [] };
        data.items.forEach((item) => {
            const newitem = { "id": item.id, "name": item.name, "birthday": item.birthday, "phone": item.phone, "address": item.address, "email": item.email, "note": item.note };
            newdata.items.push(newitem);
        });
        return newdata;
    };

    const readData = (resolve, reject) => {
        const token = utils.get_authentication_token();
        utils.fetch_api_call("api/contacts", { headers: { "token": token } },
            (data) => {
                if (!data) {
                    resolve(JSON.stringify({ "nextId": 1, "version": 1, "items": [] }));
                }
                else {
                    decodeText(data, resolve, (errMsg) => {
                        console.log(errMsg);
                        reject(_T("ERROR_WRONG_KEY_DECODE_CONTACTS"));
                    });
                }
            },
            reject);
    };

    const saveData = (data, resolve, reject) => {
        const token = utils.get_authentication_token();
        const headers = { "Accept": "application/json", "Content-Type": "application/json", "token": token };
        if (data.items.length === 0) {
            utils.fetch_api_call("api/contacts", { method: "DELETE", headers: headers }, resolve, reject);
        }
        else {
            encodeText(
                JSON.stringify(data),
                (encodedData) => {
                    utils.fetch_api_call("api/contacts", { method: "PUT", headers: headers, body: JSON.stringify(encodedData) }, resolve, reject);
                },
                reject);
        }
    };

    // rendering

    const renderHeader = (parent) => {
        helpDiv = controls.createDiv(document.body);
        const h1 = controls.create(parent, "h1", undefined, `${currentUser.name} - ${_T("HEADER_CONTACTS")}`);
        const helpImg = controls.createImg(h1, "help-button", 24, 24, "/images/buttons/help.png", _T("BUTTON_HELP"));
        helpImg.addEventListener("click", () => onUpdateHelp(true));
        if (currentUser && currentUser.photo) {
            const imgPhoto = controls.createImg(parent, "header-profile-photo", 32, 32, currentUser.photo, _T("BUTTON_PROFILE"));
            imgPhoto.addEventListener("click", () => utils.set_window_location("/usermgmt"));
        }
    };

    const renderCopyright = (parent) => {
        const div = controls.createDiv(parent);
        controls.create(div, "span", "copyright", `${_T("HEADER_CONTACTS")} ${version}. ${_T("TEXT_COPYRIGHT")} 2022 `);
        controls.createA(div, "copyright", "/view?page=copyright", _T("COPYRIGHT"));
        controls.create(div, "span", "copyright", ".");
    };

    const renderError = (errMsg) => {
        const elem = document.getElementById("error-id");
        if (elem) {
            elem.textContent = _T(errMsg);
        }
        else {
            const parent = document.body;
            controls.removeAllChildren(parent);
            renderHeader(parent, _T("INFO_ERROR_OCCURED"));
            controls.createDiv(parent, "error").textContent = _T(errMsg);
            renderCopyright(parent);
        }
    };

    const renderEncryptKeyAsync = async (parent) => {
        utils.create_menu(parent);
        renderHeader(parent);
        const encryptKey = await utils.get_encryption_key_async(currentUser);
        const div = controls.createDiv(parent, "hide");
        div.id = "div-encryptkey-id";
        const encryptP = controls.create(div, "p");
        encryptP.id = "p-encryptkey-notice-id";
        controls.create(encryptP, "p", "encryptkey-notice", _T("INFO_ENCRYPTION_CONTACTS"));
        const keyP = controls.create(div, "p");
        const keyLabel = controls.createLabel(keyP, undefined, _T("LABEL_KEY"));
        keyLabel.htmlFor = "input-encryptkey-id";
        const inputKey = controls.createInputField(keyP, _T("TEXT_KEY"), () => onChangeEncryptKeyAsync(), undefined, 32, 32);
        inputKey.id = "input-encryptkey-id";
        inputKey.addEventListener("change", () => onChangeEncryptKeyAsync());
        if (encryptKey) {
            inputKey.value = encryptKey;
        }
        const saveP = controls.create(div, "p");
        const show = encryptKey == undefined;
        controls.createCheckbox(saveP, "checkbox-save-encryptkey-id", undefined,
            _T("OPTION_SAVE_KEY_IN_BROWSER"), !show, () => onChangeEncryptKeyAsync());
        utils.show_encrypt_key(currentUser, show);
        utils.set_menu_items(currentUser);
    };

    const renderActions = (confirm) => {
        if (!currentItem) return;
        const actionContainer = document.getElementById("action-id");
        controls.removeAllChildren(actionContainer);
        if (confirm === "delete") {
            document.getElementById("item-id").style.display = "none";
            const contactName = document.getElementById("name-id").value;
            controls.create(actionContainer, "span", "confirmation", _T("INFO_REALLY_DELETE_CONTACT_1", contactName));
            const buttonContainer = controls.create(actionContainer, "p");
            controls.createButton(buttonContainer, _T("BUTTON_YES"), () => onDeleteContact(currentItem));
            controls.createButton(buttonContainer, _T("BUTTON_NO"), () => renderActions());
        }
        else if (confirm === "back") {
            if (!isChanged) {
                onBack();
            }
            else {
                document.getElementById("item-id").style.display = "none";
                const contactName = document.getElementById("name-id").value;
                controls.create(actionContainer, "span", "confirmation", _T("INFO_REALLY_BACK_NOT_SAVED_1", contactName));
                const buttonContainer = controls.create(actionContainer, "p");
                controls.createButton(buttonContainer, _T("BUTTON_YES"), () => onBack());
                controls.createButton(buttonContainer, _T("BUTTON_NO"), () => renderActions());
            }
        }
        else {
            document.getElementById("item-id").style.display = "block";
            controls.createButton(actionContainer, _T("BUTTON_BACK"), () => renderActions("back"), undefined, "button");
            controls.createButton(actionContainer, _T("BUTTON_DELETE"), () => renderActions("delete"), undefined, "button");
            if (isChanged) {
                controls.createButton(actionContainer, _T("BUTTON_SAVE"), () => onSaveContact(currentItem), undefined, "button");
            }
        }
    };

    const renderTextField = (parent, idname, key, val, displayLen, len) => {
        const p = controls.create(parent, "p");
        const l = controls.createLabel(p, undefined, _T(`LABEL_${key}`));
        l.htmlFor = `${idname}-id`;
        const input = controls.createInputField(p, _T(`TEXT_${key}`), undefined, undefined, displayLen, len);
        input.id = `${idname}-id`;
        input.value = val;
        input.addEventListener("input", () => {
            if (!isChanged && currentItem) {
                isChanged = true;
                renderActions(currentItem);
            }
        });
    };

    const renderContactItemDetails = (item, setFocus) => {
        currentItem = item;
        const parent = document.getElementById("details-id");
        const content = document.getElementById("content-id");
        parent.style.display = "block";
        content.style.display = "none";
        controls.removeAllChildren(parent);
        controls.create(parent, "p").id = "action-id";
        const itemContainer = controls.createDiv(parent);
        itemContainer.id = "item-id";
        renderActions();
        renderTextField(itemContainer, "name", "NAME", item.name, 40, 80);
        renderTextField(itemContainer, "address", "ADDRESS", item.address, 40, 80);
        renderTextField(itemContainer, "phone", "PHONE", item.phone, 40, 80);
        renderTextField(itemContainer, "birthday", "BIRTHDAY", item.birthday, 10, 10);
        renderTextField(itemContainer, "email", "EMAIL_ADDRESS", item.email, 40, 80);
        const p = controls.create(itemContainer, "p");
        const l = controls.createLabel(p, undefined, _T("LABEL_NOTE"));
        l.htmlFor = "note-id";
        const txt = controls.create(p, "textarea", undefined, item.note);
        txt.id = "note-id";
        txt.rows = 4;
        txt.maxLength = 1000;
        if (!utils.is_mobile()) {
            txt.cols = 39;
            if (setFocus) {
                document.getElementById("name-id").focus();
            }
        }
        else {
            txt.cols = 32;
        }
        txt.addEventListener("input", () => {
            if (!isChanged && currentItem) {
                isChanged = true;
                renderActions();
            }
        });
    };

    const renderContactsTable = (parent, items, filteredItems) => {
        controls.removeAllChildren(parent);
        const table = controls.create(parent, "table");
        const tbody = controls.create(table, "tbody");
        const all = filteredItems ? filteredItems : items;
        all.forEach(item => {
            const tr = controls.create(tbody, "tr");
            const tdname = controls.create(tr, "td");
            const name = item.name.length > 0 ? item.name : _T("TEXT_NEW");
            controls.createA(tdname, undefined, "#open", name, () => renderContactItemDetails(item));
            controls.create(tr, "td", undefined, item.birthday);
            if (!utils.is_mobile()) {
                controls.create(tr, "td", undefined, item.phone);
                controls.create(tr, "td", undefined, item.address);
            }
        });
    };

    const renderSortOptions = () => {
        const sortContainer = document.getElementById("sortoptions-id");
        controls.removeAllChildren(sortContainer);
        controls.createRadiobutton(sortContainer, "sort-firstname-id", "sort-contacts", "firstname", _T("TEXT_FIRSTNAME"), sortAttribute === "firstname", onSortOptionChanged);
        controls.createRadiobutton(sortContainer, "sort-lastname-id", "sort-contacts", "lastname", _T("TEXT_LASTNAME"), sortAttribute === "lastname", onSortOptionChanged);
        controls.createRadiobutton(sortContainer, "sort-birthday-id", "sort-contacts", "birthday", _T("TEXT_BIRTHDAY"), sortAttribute === "birthday", onSortOptionChanged);
    };

    const renderContactItems = (items) => {
        const parent = document.getElementById("content-id");
        controls.removeAllChildren(parent);
        const buttonContainer = controls.create(parent, "p");
        controls.createButton(buttonContainer, _T("BUTTON_CREATE_NEW_CONTACT"), () => onNewContact(), undefined, "button");
        if (items.length > 0) {
            const filterDiv = controls.create(parent, "p"); 
            const searchLabel = controls.createLabel(filterDiv, undefined, _T("LABEL_FILTER"));
            searchLabel.htmlFor = "filter-id";
            filterInput = controls.createInputField(filterDiv, _T("TEXT_FILTER"), undefined, undefined, 27, 32);
            filterInput.id = "filter-id";
            filterInput.addEventListener("input", () => onFilterItems(items));
            controls.create(parent, "p").id ="sortoptions-id";
            renderSortOptions();
            contactItemsDiv = controls.createDiv(parent);
            renderContactsTable(contactItemsDiv, items);
        }
    };

    const renderContacts = () => {
        renderError("");
        renderContactItems([]);
        if (!hasEncryptKey()) {
            renderError("ERROR_MISSING_KEY_DECODE_CONTACTS");
        }
        else if (contactsData == undefined) {
            onLoadContacts();
        }
        else {
            renderContactItems(contactsData.items);
        }
    };

    const renderPageAsync = async (parent) => {
        await renderEncryptKeyAsync(parent);
        controls.createDiv(parent, "details").id = "details-id";
        controls.createDiv(parent, "content").id = "content-id";
        controls.createDiv(parent, "error").id = "error-id";
        renderCopyright(parent);
        renderContacts();
    };

    const render = () => {
        isChanged = false;
        sortAttribute = "firstname";
        sortUp = true;
        const parent = document.body;
        controls.removeAllChildren(parent);
        cryptoKey = undefined;
        const token = utils.get_authentication_token();
        if (!token) {
            const nexturl = "/contacts";
            utils.set_window_location("/pwdman?nexturl=" + encodeURI(nexturl));
            return;
        }
        utils.fetch_api_call("api/pwdman/user", { headers: { "token": token } },
            (user) => {
                currentUser = user;
                renderPageAsync(parent);
            },
            (errMsg) => console.error(errMsg));
    };

    // --- callbacks

    const onSortOptionChanged = (elem) => {
        if (elem.value === sortAttribute) {
            sortUp = !sortUp;
        }
        else {
            sortAttribute = elem.value;
            sortUp = true;
            renderSortOptions();
        }
        sortItems(contactsData.items);
        renderContactItems(contactsData.items);
    };

    const onLoadContacts = () => {
        readData(
            (data) => {
                contactsData = JSON.parse(data);
                sortItems(contactsData.items);
                renderContactItems(contactsData.items);
            },
            renderError);
    };

    const onNewContact = () => {
        const newitem = {
            "id": contactsData.nextId,
            "name": "",
            "address": "",
            "phone": "",
            "birthday": "",
            "email": "",
            "note": ""
        };
        const newdata = cloneData(contactsData);
        newdata.items.push(newitem);
        newdata.nextId += 1;
        saveData(
            newdata,
            () => {
                contactsData = newdata;
                sortItems(contactsData.items);
                renderContactItems(contactsData.items);
                renderContactItemDetails(newitem, true);
            },
            renderError);
    };

    const onDeleteContact = (item) => {
        const newdata = cloneData(contactsData);        
        newdata.items = newdata.items.filter(elem => elem.id != item.id);
        saveData(
            newdata,
            () => {
                contactsData = newdata;
                renderContactItems(contactsData.items);
                onBack();
            },
            renderError);
    };

    const onSaveContact = (item) => {
        const newdata = cloneData(contactsData);
        let newitem;
        newdata.items.forEach(n => {
            if (n.id === item.id) {
                newitem = n;
            }
        });
        newitem.name = document.getElementById("name-id").value;
        newitem.address = document.getElementById("address-id").value;
        newitem.phone = document.getElementById("phone-id").value;
        newitem.birthday = document.getElementById("birthday-id").value;
        newitem.email = document.getElementById("email-id").value;
        newitem.note = document.getElementById("note-id").value;
        saveData(
            newdata,
            () => {
                contactsData = newdata;
                sortItems(contactsData.items);
                renderContactItems(contactsData.items);
                onBack();
            },
            renderError
        );
    };

    const onBack = () => {
        isChanged = false;
        const parent = document.getElementById("details-id");
        const content = document.getElementById("content-id");
        controls.removeAllChildren(parent);
        parent.style.display = "none";
        content.style.display = "block";
    };

    const onFilterItems = (items) => {
        const v = filterInput.value.toLowerCase();
        if (v.length > 0) {
            const filteredItems = [];
            items.forEach(item => {
                if (item.name.toLowerCase().includes(v)) {
                    filteredItems.push(item);
                }
            });
            renderContactsTable(contactItemsDiv, items, filteredItems);
        }
        else {
            renderContactsTable(contactItemsDiv, items);
        }
    };

    const onUpdateHelp = (show) => {
        if (helpDiv) {
            helpDiv.className = show ? "help-div" : undefined;
            controls.removeAllChildren(helpDiv);
            if (show) {
                const contentDiv = controls.createDiv(helpDiv, "help-content");
                const mdDiv = controls.createDiv(contentDiv, "help-item");
                utils.fetch_api_call(`/api/pwdman/markdown/help-contacts?locale=${utils.get_locale()}`, undefined, (html) => mdDiv.innerHTML = html);
                controls.createButton(contentDiv, _T("BUTTON_OK"), () => onUpdateHelp(false)).focus();
            }
        }
    };
    
    const onChangeEncryptKeyAsync = async () => {
        const saveInBrowser = document.getElementById("checkbox-save-encryptkey-id").checked;
        const val = document.getElementById("input-encryptkey-id").value.trim();
        if (val.length === 0 || !saveInBrowser) {
            await utils.set_encryption_key_async(currentUser);
        }
        else {
            await utils.set_encryption_key_async(currentUser, val);
        }
        cryptoKey = undefined;
        renderContacts();
    };

    // --- public API

    return {
        render: render
    };
})();

window.onload = () => utils.auth_lltoken(() => utils.set_locale(contacts.render));

window.onclick = (event) => utils.hide_menu(event);