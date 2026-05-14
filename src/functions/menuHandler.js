const { getDatabase, ref, onValue } = require("firebase/database");

async function getDynamicMenu(commandName) {
    const db = getDatabase();
    const menuRef = ref(db, 'menus/' + commandName);
    
    return new Promise((resolve) => {
        onValue(menuRef, (snapshot) => {
            const data = snapshot.val();
            resolve(data ? data.text : null);
        });
    });
}

module.exports = { getDynamicMenu };