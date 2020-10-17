"use strict";

var skatticket = (() => {

    let passwordElem;

    let imgHeight = 140;
    let imgWidth = 90;

    const render = () => {
        controls.removeAllChildren(document.body);
        document.body.className = "inactive-background";
        let divMain = controls.createDiv(document.body);
        controls.create(divMain, "p", "welcome", "Willkommen beim Online Skat!");
        let divInfoImages = controls.createDiv(divMain);
        controls.createImg(divInfoImages, undefined, imgWidth, imgHeight, "/images/skat/28.gif");
        controls.createImg(divInfoImages, undefined, imgWidth, imgHeight, "/images/skat/20.gif");
        controls.createImg(divInfoImages, undefined, imgWidth, imgHeight, "/images/skat/12.gif");
        controls.createImg(divInfoImages, undefined, imgWidth, imgHeight, "/images/skat/04.gif");
        controls.createLabel(divMain, undefined, "Ticket:");
        passwordElem = controls.createPasswordField(divMain, "ticket", btnLogin_click, "ticket-password", 20, 32);
        passwordElem.focus();
        controls.createButton(divMain, "Anmelden", btnLogin_click);
    };

    const btnLogin_click = () => {
        const t = passwordElem.value.trim();
        if (t.length > 0) {
            fetch("api/skat/model", { headers: { "ticket": t } })
                .then(response => response.json())
                .then(model => {
                    if (model && model.currentUser) {
                        sessionStorage.setItem("ticket", t);
                        location.pathname = "skat.html";
                    }
                    else {
                        passwordElem.value = "";
                    }
                })
                .catch((err) => console.error(err));
        }
    };

    // --- public API

    return {
        render: render
    };
})();

window.onload = () => {
    skatticket.render();
};
