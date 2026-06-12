# Install Echo App Center on Windows

Use only the root installer:

```text
INSTALL.bat
```

This package was cleaned so there are not multiple competing install buttons or setup paths.


## Packaging validation note

The Electron main process must build to `dist-electron/main.js`. The final check now verifies this before the Windows/Linux desktop package step runs.
