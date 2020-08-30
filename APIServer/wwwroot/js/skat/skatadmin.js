"use strict";

var skatadmin = (() => {

    let passwordElem;
    let adminTicket;

    const renderPage = (tickets) => {
        let body = document.querySelector("body");
        body.style.background = "#000000";
        controls.removeAllChildren(body);
        controls.create(body, "p", undefined, "Online Skat Administration");
        if (tickets) {
            if (tickets.length == 0) {
                controls.create(body, "p", undefined, "Niemand ist angemeldet.");
            }
            else {
                let ul = controls.create(body, "ul");
                tickets.forEach((info) => controls.create(ul, "li", undefined, info));
                controls.createButton(body, "Reset", btnReset_click);
            }
        }
        else {
            controls.createLabel(body, undefined, "Passwort:");
            passwordElem = controls.createPasswordField(body, "password", btnLogin_click);
            passwordElem.focus();
            controls.createButton(body, "Anmelden", btnLogin_click);
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
