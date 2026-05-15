const fs = require('fs');
let c = fs.readFileSync('src/app/(dashboard)/reports/daily-summary/page.tsx', 'utf8');

c = c.replace(
  "{loading ? '⏳...' : '🔄 รีเฟรช'}\n                </button>\n            </div>",
  "{loading ? '⏳...' : '🔄 รีเฟรช'}\n                    </button>\n                </div>\n            </div>"
);

// Fallback for CRLF
c = c.replace(
  "{loading ? '⏳...' : '🔄 รีเฟรช'}\r\n                </button>\r\n            </div>",
  "{loading ? '⏳...' : '🔄 รีเฟรช'}\r\n                    </button>\r\n                </div>\r\n            </div>"
);

fs.writeFileSync('src/app/(dashboard)/reports/daily-summary/page.tsx', c);
