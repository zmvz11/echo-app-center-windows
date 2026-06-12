# Echo GitHub App Source

Add Apps can link an Echo app to a GitHub repository release source instead of uploading a release ZIP manually.

In Echo App Builder, choose **Release Source → Link GitHub Repository** and enter:

- Owner, for example `zmvz11`
- Repository, for example `echo-watchtower-sc`
- Asset pattern, for example `*windows*.zip`
- Platform and release channel

Echo App Server checks GitHub Releases, stores the latest release metadata, imports the selected release asset as a draft package, and marks linked apps when a newer GitHub Release is available.
