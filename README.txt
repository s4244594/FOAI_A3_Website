FOAI A3 WEBSITE - HOW TO RUN IT
================================

This guide assumes you have never used GitHub or Git before. Follow the
steps in order and you will have the website running on your own computer.

You will need:
  - A computer with internet access (Windows, Mac or Linux)
  - About 15 minutes


------------------------------------------------------------
STEP 1 - INSTALL GIT
------------------------------------------------------------

Git is the program that downloads ("clones") the project from GitHub.

  1. Go to https://git-scm.com/downloads
  2. Download the installer for your operating system.
  3. Run the installer. Clicking "Next" on every screen and keeping the
     default options is fine.
  4. To check it worked, open a terminal:
       - Windows: press the Windows key, type "Command Prompt", press Enter
       - Mac: press Cmd + Space, type "Terminal", press Enter
     Then type the following and press Enter:

         git --version

     If you see something like "git version 2.xx.x", Git is installed.


------------------------------------------------------------
STEP 2 - CLONE (DOWNLOAD) THE PROJECT USING HTTPS
------------------------------------------------------------

"Cloning" means making a copy of the project on your computer.

  1. In the terminal, move to the folder where you want the project to go.
     For example, to put it on your Desktop, type:

         cd Desktop

  2. Type this command and press Enter:

         git clone https://github.com/s4244594/FOAI_A3_Website.git

     (You can also find this link on the GitHub page for the project:
     click the green "Code" button, choose the "HTTPS" tab, and click the
     copy icon next to the link.)

  3. When it finishes, you will have a new folder called "FOAI_A3_Website"
     in that location (e.g. on your Desktop).

  No GitHub account or password is needed for this step as long as the
  repository is public. If the repository is private, Git will ask you to
  sign in to GitHub in a browser window - use the account that has been
  given access.

  Alternative (no Git): on the GitHub page, click the green "Code" button
  and choose "Download ZIP". Unzip the file and use the folder inside it.


------------------------------------------------------------
STEP 3 - INSTALL VISUAL STUDIO CODE
------------------------------------------------------------

Visual Studio Code (VS Code) is a free code editor. We use it to open the
project and run the website.

  1. Go to https://code.visualstudio.com/
  2. Download and run the installer for your operating system.
  3. Keep the default options and finish the installation.


------------------------------------------------------------
STEP 4 - INSTALL THE "LIVE SERVER" EXTENSION
------------------------------------------------------------

Live Server is an add-on for VS Code that runs the website in your web
browser and refreshes it automatically when files change.

  1. Open VS Code.
  2. Click the Extensions icon on the left-hand side bar (it looks like
     four small squares), or press Ctrl + Shift + X (Cmd + Shift + X on Mac).
  3. In the search box at the top, type:  Live Server
  4. Find the one called "Live Server" by Ritwick Dey and click "Install".


------------------------------------------------------------
STEP 5 - OPEN THE PROJECT IN VS CODE
------------------------------------------------------------

  1. In VS Code, click "File" in the top menu, then "Open Folder..."
  2. Find and select the "FOAI_A3_Website" folder you cloned in Step 2,
     then click "Select Folder" (or "Open" on Mac).
  3. If VS Code asks "Do you trust the authors of the files in this
     folder?", click "Yes, I trust the authors".
  4. In the file list on the left you should see:

         FOAI_A3_Website
           FOAI_A3
             assets
             css
             js
             index.html
           README.txt


------------------------------------------------------------
STEP 6 - RUN THE WEBSITE WITH LIVE SERVER
------------------------------------------------------------

  1. In the file list on the left, open the "FOAI_A3" folder.
  2. Right-click on "index.html".
  3. Click "Open with Live Server".
  4. Your web browser will open and show the website. The address will
     look something like:

         http://127.0.0.1:5500/FOAI_A3/index.html

  Another way: open index.html, then click "Go Live" in the blue bar at
  the bottom-right of the VS Code window.

  To stop the website, click "Port : 5500" in the bottom-right of VS Code
  (where "Go Live" was), or simply close VS Code.


------------------------------------------------------------
TROUBLESHOOTING
------------------------------------------------------------

  "git is not recognized as a command"
      Git is not installed, or the terminal was opened before installing.
      Close the terminal, open a new one, and try again. If it still fails,
      reinstall Git (Step 1).

  I don't see "Open with Live Server" when I right-click
      Make sure the Live Server extension is installed (Step 4), then
      restart VS Code. Make sure you right-clicked "index.html" and not a
      folder.

  The page is blank or images/styles are missing
      Make sure you opened the whole "FOAI_A3_Website" folder in VS Code
      (Step 5), not just the index.html file on its own.

  The browser didn't open automatically
      Open your browser yourself and go to:
      http://127.0.0.1:5500/FOAI_A3/index.html
