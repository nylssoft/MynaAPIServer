var controls = (() => {

    "use strict";

    // ---- create HTML elements

    const create = (parent, name, classid, txt) => {
        let e = document.createElement(name);
        if (classid) {
            e.setAttribute("class", classid);
        }
        if (parent) {
            parent.appendChild(e);
        }
        if (txt) {
            e.textContent = txt;
        }
        return e;
    };

    const createSpan = (parent, classname, txt) => {
        return create(parent, "span", classname, txt);
    };

    const createDiv = (parent, classname) => {
        return create(parent, "div", classname);
    };

    const createButton = (parent, txt, action, value, classname) => {
        if (!classname) {
            classname = "button";
        }
        let b = create(parent, "button", classname);
        b.title = txt;
        b.textContent = txt;
        if (action) {
            b.addEventListener("click", e => action(b));
        }
        if (value) {
            b.value = value;
        }
        return b;
    };

    const createImg = (parent, classname, width, height, src, title, alt) => {
        let img = create(parent, "img", classname);
        if (width) {
            img.width = width;
        }
        if (height) {
            img.height = height;
        }
        if (src) {
            img.src = src;
        }
        if (title) {
            img.title = title;
        }
        if (alt) {
            img.alt = alt;
        }
        img.ondragstart = function () { return false; };
        return img;
    };

    const createA = (parent, classname, href, txt, action) => {
        let a = create(parent, "a", classname);
        if (href) {
            a.href = href;
        }
        if (txt) {
            a.textContent = txt;
        }
        if (action) {
            a.addEventListener("click", e => {
                e.preventDefault();
                action();
            });
        }
        return a;
    };

    const createLabel = (parent, classname, txt) => {
        return create(parent, "label", classname, txt);
    };

    const createInputField = (parent, title, action, classname, size, maxlength) => {
        let input = create(parent, "input", classname);
        input.title = title;
        input.setAttribute("type", "text");
        input.setAttribute("size", size);
        input.setAttribute("maxlength", maxlength);
        if (action) {
            input.addEventListener("keyup", e => {
                e.preventDefault();
                if (e.keyCode === 13) {
                    action();
                }
            });
        }
        return input;
    };

    const createPasswordField = (parent, title, action, classname, size, maxlength) => {
        let input = createInputField(parent, title, action, classname, size, maxlength);
        input.setAttribute("type", "password");
        return input;
    };

    const createImageButton = (parent, title, action, image, imagesize, classname) => {
        let button = create(parent, "button", classname);
        button.title = title;
        if (action) {
            button.addEventListener("click", e => action(button));
        }
        let img = create(button, "img");
        img.src = image;
        img.title = title;
        img.height = imagesize;
        img.width = imagesize;
        return button;
    };

    const createProgress = (parent, classname) => {
        return create(parent, "progress", classname);
    };

    const createCheckbox = (parent, id, name, txt, checked, action, disabled) => {
        let label = create(parent, "label", "container-checkbox");
        label.textContent = txt;
        let input = create(label, "input");
        input.id = id;
        input.name = name;
        input.type = "checkbox";
        if (checked) {
            input.setAttribute("checked", "checked");
        }
        if (disabled) {
            input.disabled = true;
        }
        else if (action) {
            input.addEventListener("click", e => action(input));
        }
        create(label, "span", "checkmark-checkbox");        
        return input;
    };

    const createRadiobutton = (parent, id, name, value, txt, checked, action, disabled) => {
        let label = create(parent, "label", "container-radiobutton");
        label.setAttribute("for", id);
        label.textContent = txt;
        let input = create(label, "input");
        input.type = "radio";
        input.id = id;
        input.name = name;
        input.value = value;
        if (checked) {
            input.setAttribute("checked", "checked");
        }
        if (disabled) {
            input.disabled = true;
        }
        else if (action) {
            input.addEventListener("click", e => action(input));
        }
        create(label, "span", "checkmark-radiobutton");
        return input;
    };

    const createSelect = (parent, id, classname, options) => {
        let select = create(parent, "select", classname);
        select.id = id;
        select.name = id;
        if (options) {
            options.forEach(opt => {
                let option = create(select, "option", undefined, opt.name);
                option.setAttribute("value", opt.value);
            });
        }
        return select;
    };

    const createOption = (parent, opt) => {
        let option = create(parent, "option", undefined, opt.name);
        option.setAttribute("value", opt.value);
        return option;
    };

    const createMenu = (parent, itemactions) => {
        if (itemactions.length === 0) return undefined;
        let menu = createDiv(parent, "menu");
        createImg(menu, undefined, 24, 24, "/images/buttons/hamburger_menu.svg");
        let divContent = createDiv(menu, "menu-content");
        itemactions.forEach(itemaction => {
            createA(divContent, undefined, "#", itemaction.name, itemaction.action);
        });
        menu.addEventListener("mouseover", ev => {
            show(divContent, true);
        });
        menu.addEventListener("mouseout", ev => hide(divContent));
        return menu;
    };

    // --- common helpers

    const hide = (elem) => {
        elem.style.display = "none";
    };

    const show = (elem, inline) => {
        elem.style.display = inline ? "inline" : "block";
    };

    const removeAllChildren = (parent) => {
        let node = parent;
        while (node.lastChild) {
            node.removeChild(node.lastChild);
        }
    };

    // --- public API

    return {
        create: create,
        createSpan: createSpan,
        createDiv: createDiv,
        createButton: createButton,
        createImg: createImg,
        createA: createA,
        createLabel: createLabel,
        createInputField: createInputField,
        createPasswordField: createPasswordField,
        createImageButton: createImageButton,
        createProgress: createProgress,
        createSelect: createSelect,
        createRadiobutton: createRadiobutton,
        createCheckbox: createCheckbox,
        createOption: createOption,
        createMenu: createMenu,
        hide: hide,
        show: show,
        removeAllChildren: removeAllChildren
    };
})();

