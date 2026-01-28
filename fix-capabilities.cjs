const fs = require('fs');
const path = 'c:/Users/digit/Downloads/SaaS-Architect/SaaS-Architect/client/src/pages/prompt-create.tsx';
let content = fs.readFileSync(path, 'utf8');

// Find the capabilities grid section - it starts with <div className="grid gap-2"> after "Business-Ready Capabilities"
const businessCapIdx = content.indexOf('Business-Ready Capabilities');
if (businessCapIdx === -1) {
    console.log('Could not find Business-Ready Capabilities');
    process.exit(1);
}

// Find the grid div after Business-Ready Capabilities
const gridStart = content.indexOf('<div className="grid gap-2">', businessCapIdx);
if (gridStart === -1) {
    console.log('Could not find grid div');
    process.exit(1);
}

// Find the end of the grid section - try different patterns
let gridEnd = content.indexOf('</div>\n                    </div>\n                  </CardContent>', gridStart);
if (gridEnd === -1) {
    // Try with \r\n
    gridEnd = content.indexOf('</div>\r\n                    </div>\r\n                  </CardContent>', gridStart);
}
if (gridEnd === -1) {
    // Search for the pattern more flexibly
    const endMatch = content.substring(gridStart).match(/<\/div>\s*<\/div>\s*<\/CardContent>/);
    if (endMatch) {
        gridEnd = gridStart + endMatch.index;
    }
}
if (gridEnd === -1) {
    console.log('Could not find end of grid section');
    // Show what's around the grid
    console.log('Context:', content.substring(gridStart, gridStart + 200));
    process.exit(1);
}

// Build the new capability section with dynamic descriptions
const newCapSection = `{(() => {
                        const capDescs = getCapabilityDescriptions(generatedConfig.industry);
                        return (
                          <div className="grid gap-2">
                            <label className="flex items-center justify-between gap-3 rounded-md border border-white/10 bg-white/5 px-3 py-2">
                              <div>
                                <div className="text-sm text-white">{capDescs.auth.title}</div>
                                <div className="text-xs text-muted-foreground">{capDescs.auth.description}</div>
                              </div>
                              <input type="checkbox" className="h-4 w-4" checked={businessCaps.auth} onChange={(e) => setBusinessCaps((p) => ({ ...p, auth: e.target.checked }))} />
                            </label>
                            <label className="flex items-center justify-between gap-3 rounded-md border border-white/10 bg-white/5 px-3 py-2">
                              <div>
                                <div className="text-sm text-white">{capDescs.payments.title}</div>
                                <div className="text-xs text-muted-foreground">{capDescs.payments.description}</div>
                              </div>
                              <input type="checkbox" className="h-4 w-4" checked={businessCaps.payments} onChange={(e) => setBusinessCaps((p) => ({ ...p, payments: e.target.checked }))} />
                            </label>
                            <label className="flex items-center justify-between gap-3 rounded-md border border-white/10 bg-white/5 px-3 py-2">
                              <div>
                                <div className="text-sm text-white">{capDescs.admin.title}</div>
                                <div className="text-xs text-muted-foreground">{capDescs.admin.description}</div>
                              </div>
                              <input type="checkbox" className="h-4 w-4" checked={businessCaps.admin} onChange={(e) => setBusinessCaps((p) => ({ ...p, admin: e.target.checked }))} />
                            </label>
                            <label className="flex items-center justify-between gap-3 rounded-md border border-white/10 bg-white/5 px-3 py-2">
                              <div>
                                <div className="text-sm text-white">{capDescs.analytics.title}</div>
                                <div className="text-xs text-muted-foreground">{capDescs.analytics.description}</div>
                              </div>
                              <input type="checkbox" className="h-4 w-4" checked={businessCaps.analytics} onChange={(e) => setBusinessCaps((p) => ({ ...p, analytics: e.target.checked }))} />
                            </label>
                            <label className="flex items-center justify-between gap-3 rounded-md border border-white/10 bg-white/5 px-3 py-2">
                              <div>
                                <div className="text-sm text-white">{capDescs.notifications.title}</div>
                                <div className="text-xs text-muted-foreground">{capDescs.notifications.description}</div>
                              </div>
                              <input type="checkbox" className="h-4 w-4" checked={businessCaps.notifications} onChange={(e) => setBusinessCaps((p) => ({ ...p, notifications: e.target.checked }))} />
                            </label>
                            <label className="flex items-center justify-between gap-3 rounded-md border border-white/10 bg-white/5 px-3 py-2">
                              <div>
                                <div className="text-sm text-white">{capDescs.publishingChecklist.title}</div>
                                <div className="text-xs text-muted-foreground">{capDescs.publishingChecklist.description}</div>
                              </div>
                              <input type="checkbox" className="h-4 w-4" checked={businessCaps.publishingChecklist} onChange={(e) => setBusinessCaps((p) => ({ ...p, publishingChecklist: e.target.checked }))} />
                            </label>
                          </div>
                        );
                      })()}
                    </div>
                  </CardContent>`;

// Replace the section
const beforeGrid = content.substring(0, gridStart);
const afterSection = content.substring(gridEnd + '</div>\n                    </div>\n                  </CardContent>'.length);

content = beforeGrid + newCapSection + afterSection;
fs.writeFileSync(path, content, 'utf8');
console.log('Successfully updated capabilities section');
