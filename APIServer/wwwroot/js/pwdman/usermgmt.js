"use strict";

var usermgmt = (() => {

    // state

    let currentUser;
    let confirmations;
    let errorMessage;
    let token;
    let nexturl;

    let version = "1.0.2";

    // rendering

    const renderHeader = (parent, intro) => {
        controls.create(parent, "h1", undefined, "Kontoverwaltung");
        if (intro) {
            controls.create(parent, "p", undefined, intro);
        }
    };

    const renderCopyright = (parent, title) => {
        let div = controls.createDiv(parent);
        controls.create(div, "span", "copyright", `Myna User Manager ${version}. Copyright 2020 `);
        let a = controls.createA(div, "copyright", "https://github.com/nylssoft/", "Niels Stockfleth");
        a.target = "_blank";
        controls.create(div, "span", "copyright", `. Alle Rechte vorbehalten. `);
        controls.createA(div, "copyright", "/slideshow", "Home");
    };

    const renderConfirmRegistrations = (success, results) => {
        let parent = document.body;
        controls.removeAllChildren(parent);
        if (success) {
            renderHeader(parent, "Ergebnisse:");
            results.forEach((r) => {
                let div = controls.createDiv(parent);
                if (r.errmsg) {
                    div.textContent = `Fehler f\u00FCr E-Mail-Adresse ${r.email}: ${r.errmsg}`;
                }
                else if (r.token) {
                    div.textContent = `Die E-Mail-Adresse ${r.email} hat den Registrierungscode ${r.token}.`;
                }
                else {
                    div.textContent = `Die Registrierung f\u00FCr die E-Mail-Adresse ${r.email} wurde abgelehnt.`;
                }
            });
            let p = controls.create(parent, "p");
            controls.createButton(p, "OK", () => render());
            renderCopyright(parent);
            return;
        }
        renderHeader(parent, "Registrierungen:");
        let idx = 0;
        confirmations.forEach((confirmation) => {
            let div = controls.createDiv(parent);
            let dt = new Date(confirmation.requestedUtc).toLocaleString("de-DE");
            controls.createCheckbox(div, `confirm-registration-${idx}`, undefined, undefined, false, () => { });
            controls.create(div, "span", undefined, `E-Mail-Adresse ${confirmation.email} vom ${dt}.`);
            idx++;
        });
        controls.create(parent, "p", undefined, "Optionen:");
        let sendEmailDiv = controls.createDiv(parent);
        let emailCheckbox = controls.createCheckbox(sendEmailDiv, undefined, undefined, "Antwort-E-Mail verschicken", false, undefined, false);
        emailCheckbox.id = "send-emailnotification-id";
        let errorDiv = controls.createDiv(parent, "error");
        errorDiv.id = "error-id";
        let p = controls.create(parent, "p");
        controls.createButton(p, "Best\u00E4tigen", () => onConfirmRegistration());
        controls.createButton(p, "Ablehnen", () => onConfirmRegistration(true));
        controls.createButton(p, "Abbrechen", () => renderCurrentUser());
        renderCopyright(parent);
    };

    const renderCurrentUser = () => {
        let parent = document.body;
        controls.removeAllChildren(parent);
        renderHeader(parent);
        let nameP = controls.create(parent, "p");
        controls.createSpan(nameP, undefined, "Name: ");
        controls.createSpan(nameP, undefined, currentUser.name);
        let emailP = controls.create(parent, "p");
        controls.createSpan(emailP, undefined, "E-Mail-Adresse: ");
        controls.createSpan(emailP, undefined, currentUser.email);
        let faP = controls.create(parent, "p");
        controls.createCheckbox(faP, "account-2fa-id", undefined, "Zwei-Schritt-Verifizierung",
            currentUser.requires2FA,
            () => renderAccountActions("change2fa"));
        let lastLoginP = controls.create(parent, "p");
        let dt = new Date(currentUser.lastLoginUtc).toLocaleString("de-DE");
        controls.createSpan(lastLoginP, undefined, "Letzte Anmeldung: ");
        controls.createSpan(lastLoginP, undefined, dt);
        let registeredP = controls.create(parent, "p");
        dt = new Date(currentUser.registeredUtc).toLocaleString("de-DE");
        controls.createSpan(registeredP, undefined, "Registriert seit: ");
        controls.createSpan(registeredP, undefined, dt);
        controls.create(parent, "p").id = "account-actions-id";
        renderAccountActions();
        renderCopyright(parent);
    };

    const renderAccountActions = (confirm) => {
        let actionsDiv = document.getElementById("account-actions-id");
        controls.removeAllChildren(actionsDiv);
        if (confirm == "deleteaccount") {
            controls.create(actionsDiv, "span", "confirmation", "Willst Du Dein Konto wirklich l\u00F6schen? ");
            controls.createButton(actionsDiv, "Ja", () => onDeleteCurrentUser());
            controls.createButton(actionsDiv, "Nein", () => renderAccountActions());
        }
        else if (confirm == "logout") {
            controls.create(actionsDiv, "span", "confirmation", "Willst Du Dich wirklich abmelden? ");
            controls.createButton(actionsDiv, "Ja", () => onLogout());
            controls.createButton(actionsDiv, "Nein", () => renderAccountActions());
        }
        else if (confirm == "change2fa") {
            controls.create(actionsDiv, "span", "confirmation", "Willst Du die \u00C4nderung speichern? ");
            controls.createButton(actionsDiv, "Ja", () => onUpdateCurrentUser());
            controls.createButton(actionsDiv, "Nein", () => renderCurrentUser());
        }
        else {
            controls.createButton(actionsDiv, "Abmelden", () => renderAccountActions("logout"));
            controls.createButton(actionsDiv, "Kennwort \u00E4ndern", () => onChangePassword());
            controls.createButton(actionsDiv, "Konto l\u00F6schen", () => renderAccountActions("deleteaccount"));
            if (confirmations) {
                let mgmtDiv = controls.create(actionsDiv, "p");
                controls.createButton(mgmtDiv, "Registrierungen bearbeiten", () => renderConfirmRegistrations());
            }
        }
    };

    const renderLogout = () => {
        token = undefined;
        let parent = document.body;
        controls.removeAllChildren(parent);
        renderHeader(parent, "Du bist jetzt nicht mehr angemeldet.");
        let p = controls.create(parent, "p");
        controls.createButton(p, "OK", () => onOK());
        renderCopyright(parent);
    }

    const renderCurrentUserDeleted = () => {
        let parent = document.body;
        token = undefined;
        utils.logout();
        controls.removeAllChildren(parent);
        renderHeader(parent, "Dein Konto wurde gel\u00F6scht. Du bist jetzt nicht mehr angemeldet.");
        let p = controls.create(parent, "p");
        controls.createButton(p, "OK", () => onOK());
        renderCopyright(parent);
    };

    const renderErrorMessage = () => {
        let parent = document.body;
        controls.removeAllChildren(parent);
        renderHeader(parent, "Es ist ein Fehler aufgetreten.");
        let errorDiv = controls.createDiv(parent, "error");
        errorDiv.textContent = errorMessage;
        let p = controls.create(parent, "p");
        controls.createButton(p, "OK", () => onOK());
        renderCopyright(parent);
    };

    // --- callbacks

    const onDoConfirm = (list, results, notification, reject) => {
        if (list.length > 0) {
            let email = list.pop();
            utils.fetch_api_call("api/pwdman/confirmation",
                {
                    method: "POST",
                    headers: { "Accept": "application/json", "Content-Type": "application/json", "token": token },
                    body: JSON.stringify({ "email": email, "notification": notification, "reject": reject })
                },
                (token) => {
                    results.push({ "email": email, "token": token });
                    onDoConfirm(list, results, notification, reject);
                },
                (errmsg) => {
                    results.push({ "email": email, "errmsg": errmsg });
                    onDoConfirm(list, results, notification, reject);
                });
            return;
        }
        renderConfirmRegistrations(true, results);
    };

    const onConfirmRegistration = (reject) => {
        if (reject == undefined) {
            reject = false;
        }
        document.getElementById("error-id").textContent = "";
        let toBeConfirmed = [];
        for (let idx = 0; idx < confirmations.length; idx++) {
            let checkBox = document.getElementById(`confirm-registration-${idx}`);
            if (checkBox.checked) {
                toBeConfirmed.push(confirmations[idx].email);
            }
        }
        if (toBeConfirmed.length > 0) {
            let notification = document.getElementById("send-emailnotification-id").checked;
            let results = [];
            onDoConfirm(toBeConfirmed, results, notification, reject);
        }
        else {
            document.getElementById("error-id").textContent = "Es wurden keine Best\u00E4tigungen ausgew\u00E4hlt.";
        }
    };

    const onOK = () => {
        if (nexturl) {
            window.location.href = nexturl;
        }
        else {
            window.location.href = "/slideshow";
        }
    };

    const onLogout = () => {
        utils.logout(renderLogout, onRejectError);
    }

    const onChangePassword = () => {
        window.location.href = "/pwdman?changepwd&nexturl=" + encodeURI(window.location.href);
    };

    const onDeleteCurrentUser = () => {
        utils.fetch_api_call("api/pwdman/user",
            {
                method: "DELETE",
                headers: { "Accept": "application/json", "Content-Type": "application/json", "token": token },
                body: JSON.stringify(currentUser.name)
            },
            renderCurrentUserDeleted,
            onRejectError,
        );
    };

    const onUpdateCurrentUser = () => {
        let checkbox = document.getElementById("account-2fa-id");
        if (checkbox) {
            utils.fetch_api_call("api/pwdman/user/2fa",
                {
                    method: "PUT",
                    headers: { "Accept": "application/json", "Content-Type": "application/json", "token": token },
                    body: JSON.stringify(checkbox.checked)
                },
                (changed) => {
                    if (changed) {
                        currentUser.requires2FA = checkbox.checked;
                    }
                    renderCurrentUser();
                },
                onRejectError,
            );
        }
    };

    const onResolveConfirmations = (confirms) => {
        if (confirms.length > 0) {
            confirmations = confirms;
        }
        renderCurrentUser();
    };

    const onResolveCurrentUser = (user) => {
        currentUser = user;
        if (user.roles.includes("usermanager")) {
            utils.fetch_api_call(
                "api/pwdman/confirmation",
                { headers: { "token": token } },
                onResolveConfirmations,
                onRejectError);
        }
        else {
            renderCurrentUser();
        }
    };

    const onRejectError = (errmsg) => {
        errorMessage = errmsg;
        renderErrorMessage();
    };

    // --- start rendering

    const render = () => {
        confirmations = undefined;
        currentUser = undefined;
        errorMessage = undefined;
        token = utils.get_authentication_token();
        nexturl = new URLSearchParams(window.location.search).get("nexturl");
        utils.fetch_api_call(
            "api/pwdman/user",
            { headers: { "token": token } },
            onResolveCurrentUser,
            onRejectError);
    };

    // --- public API

    return {
        render: render
    };
})();

window.onload = () => {
    usermgmt.render();
};
