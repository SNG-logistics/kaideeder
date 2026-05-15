const fs = require('fs');
let c = fs.readFileSync('src/components/NotificationContext.tsx', 'utf8');

c = c.replace(
    /const \[uiDismissed, setUiDismissed\] = useState\(\(\) => \{[\s\S]*?return false\r?\n    \}\)/,
    `const [uiDismissed, setUiDismissed] = useState(false)

    useEffect(() => {
        if (typeof window !== 'undefined' && sessionStorage.getItem('audioUnlockedUI') === 'true') {
            setUiDismissed(true)
        }
    }, [])`
);

fs.writeFileSync('src/components/NotificationContext.tsx', c);
