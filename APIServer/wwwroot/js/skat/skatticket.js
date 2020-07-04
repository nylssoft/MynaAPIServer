"use strict";

var skatticket = (() => {

    let passwordElem;

    let imgHeight = 140;
    let imgWidth = 90;

    const render = () => {
        skatutil.removeAllChildren(document.body);
        document.body.className = "inactive-background";
        let divMain = skatutil.createDiv(document.body);
        skatutil.create(divMain, "p", "welcome", "Willkommen bei Myna Skat!");
        let divInfoImages = skatutil.createDiv(divMain);
        skatutil.createImg(divInfoImages, undefined, imgWidth, imgHeight, "/images/skat/28.gif");
        skatutil.createImg(divInfoImages, undefined, imgWidth, imgHeight, "/images/skat/20.gif");
        skatutil.createImg(divInfoImages, undefined, imgWidth, imgHeight, "/images/skat/12.gif");
        skatutil.createImg(divInfoImages, undefined, imgWidth, imgHeight, "/images/skat/04.gif");
        skatutil.createLabel(divMain, undefined, "Ticket:");
        passwordElem = skatutil.createPasswordField(divMain, "ticket", btnLogin_click);
        passwordElem.focus();
        skatutil.createButton(divMain, "Anmelden", btnLogin_click);
    };

    const btnLogin_click = () => {
        const t = passwordElem.value.trim();
        if (t.length > 0) {
            fetch("api/skat/model", { headers: { "ticket": t } })
                .then(response => response.json())
                .then(model => {
                    if (model && model.currentUser) {
                        sessionStorage.setItem("ticket", t);
                        location.pathname = "mynaskat.html";
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
