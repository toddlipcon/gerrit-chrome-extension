const TODO_CSS_CLASS = "ext-todo";
const CHANGE_DATA = {};

// Load and deserialize the local storage.
const loadLocalStorage = () => {
    let j = JSON.parse(localStorage.gerrit_extension_data || {});
    if (!j.markedSeen) {
        j.markedSeen = {};
    }
    return j;
};
// Serialize and save the local storage.
const saveLocalStorage = (s) => {
    localStorage.gerrit_extension_data = JSON.stringify(s);
};

// Callback when a response comes from the /changes gerrit REST API.
const gotChangesResponse = (changesResponse) => {
    // The REST API supports simultaneous queries (for inbound/outbound/closed reviews)
    // so we may get an array of arrays here.
    if (changesResponse.length > 0 &&
        Array.isArray(changesResponse[0])) {
        changesResponse.forEach(gotChangesResponse);
        return;
    }

    // Simply update our global CHANGE_DATA array with the data that came back
    // from the API.
    for (const change of changesResponse) {
        CHANGE_DATA[change._number] = change;
    }
};

// We can't spy on XHR directly from the extension context, so instead we inject
// a script into the document which monkey-patches XMLHttpRequest. The monkey
// patch uses a 'message' event to send the data back to us.
const injectXhrSpy = () => {
    // inject 'inject.js' into the webpage.
    let s = document.createElement('script');
    s.src = chrome.extension.getURL('inject.js');
    s.onload = function() {
        this.remove();
    };
    (document.head || document.documentElement).appendChild(s);

    window.addEventListener("message", (event) => {
        if (event.source == window && event.data.type == "FROM_PAGE") {
            gotChangesResponse(event.data.changesResponse);
        }
    }, false);
}

const injectCss = () => {
    // inject 'inject.css' into the webpage.
    let css = document.createElement('link');
    css.rel = "stylesheet";
    css.type = "text/css";
    css.href = chrome.extension.getURL('inject.css');
    (document.head || document.documentElement).appendChild(css);
};

const toggleSelectedRow = () => {
    let S = loadLocalStorage();
    $('.changeTable tr.activeRow').each((index, elem) => {
        let changeNumber = $(elem).find('td.dataCellHidden').text();
        let data = CHANGE_DATA[changeNumber] || {};
        // If it was previously marked as seen, delete it from the storage.
        // Otherwise mark it as seen with the current update timestamp.
        if (S.markedSeen[changeNumber]) {
            delete S.markedSeen[changeNumber];
        } else {
            S.markedSeen[changeNumber] = data.updated;
        }
        $(elem).toggleClass(TODO_CSS_CLASS);
    });
    saveLocalStorage(S);
}

// When the DOM changes, we want to update the CSS as required based
// on our data. However, we get one of these events for every new
// added DOM element. So, instead, this callback just schedules an
// idle callback to run once all the DOM changes are done.
const watchDom = () => {
    let callbackScheduled = undefined;
    document.addEventListener("DOMNodeInserted", (e) => {
        if (callbackScheduled) return;
        callbackScheduled = window.requestIdleCallback(() => {
            callbackScheduled = undefined;
            let S = loadLocalStorage();
            jQuery('.changeTable tr').each((index, elem) => {
                let changeNumber = $(elem).find('td.dataCellHidden').text();
                if (changeNumber) {
                    let data = CHANGE_DATA[changeNumber];
                    if (S.markedSeen[changeNumber] != data.updated) {
                        $(elem).addClass(TODO_CSS_CLASS);
                    }
                }
            });
            saveLocalStorage(S);
        });
    });
};

const watchKeyboard = () => {
    // Register a listener for the 'x' key to toggle the selected row.
    document.addEventListener("keydown", (e) => {
        // Skip if the key press is inside an input field.
        if ($(e.target).is(":input")) {
            return;
        }
        if (e.key == 'x') {
            toggleSelectedRow();
        }
    });
};

// Actually inject everything we need to do.
watchKeyboard();
watchDom();
injectXhrSpy();
injectCss();
