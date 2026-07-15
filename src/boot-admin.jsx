// Page boot for admin/index.html. Compiled to dist/src/boot-admin.js and loaded
// last. AdminApp is defined in admin/admin.jsx (loaded first) and referenced by
// bare name in the shared global scope. window.SECTORS comes from game-data.js.
ReactDOM.createRoot(document.getElementById('root')).render(<AdminApp sectors={window.SECTORS} />);
