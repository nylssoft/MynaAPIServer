"use strict";

var skatadmin = (() => {

    let passwordElem;
    let adminTicket;

    const renderPage = (tickets) => {
        let body = document.querySelector("body");
        body.style.background = "#000000";
        skatutil.removeAllChildren(body);
        skatutil.create(body, "p", undefined, "Skat Administration");
        if (tickets) {
            if (tickets.length == 0) {
                skatutil.create(body, "p", undefined, "Niemand ist angemeldet.");
            }
            else {
                let ul = skatutil.create(body, "ul");
                tickets.forEach((info) => skatutil.create(ul, "li", undefined, info));
                skatutil.createButton(body, "Reset", btnReset_click);
            }
        }
        else {
            skatutil.createLabel(body, undefined, "Passwort:");
            passwordElem = skatutil.createPasswordField(body, "password", btnLogin_click);
            passwordElem.focus();
            skatutil.createButton(body, "Anmelden", btnLogin_click);
        }
    };

    const render = () => {
        adminTicket = sessionStorage.getItem("adminticket");
        fetch("api/skat/tickets", { headers: { "ticket": adminTicket } })
            .then(response => response.json())
            .then(arr => renderPage(arr))
            .catch((err) => console.error(err));
    };

    const btnLogin_click = () => {
        const t = passwordElem.value.trim();
        if (t.length > 0) {
            sessionStorage.setItem("adminticket", t);
            render();
        }
    };

    const btnReset_click = () => {
        fetch("api/skat/reset", { method: "POST", headers: { "ticket": adminTicket } })
            .then(response => response.json())
            .then(() => render());
    };

    // --- public API

    return {
        render: render
    };
})();

window.onload = () => {
    skatadmin.render();
};
