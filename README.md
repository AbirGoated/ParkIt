Running ParkIt Locally

Follow these steps to run ParkIt on a Windows device.

Prerequisites

Before starting, make sure you have:

1. Windows 10 or later.
2. Git installed.
3. MinGW-w64 (G++ compiler) installed and added to your system PATH.
4. A web browser.

Step 1: Clone the Repository

Open Command Prompt or PowerShell and run:

git clone https://github.com/AbirGoated/ParkIt.git

Step 2: Navigate to the Project

cd ParkIt

Make sure you are in the main project directory, where "index.html", "script.js", "style.css", and the "backend" folder are located.

Step 3: Compile the C++ Backend

Run the following command:

g++ backend/main.cpp -o ParkIt.exe -lws2_32

This compiles the C++ backend and links the required Windows networking library.

If compilation succeeds, a "ParkIt.exe" file will be created in the project directory.

Step 4: Start ParkIt

Run:

.\ParkIt.exe

The C++ server will start on port "8080".

Keep the terminal running while using the application.

Step 5: Open ParkIt

Open your preferred web browser and visit:

http://localhost:8080

ParkIt should now be running locally on your device.

Step 6: Stop the Application

When you are finished, return to the terminal and press:

Ctrl + C

This stops the server.

Troubleshooting

G++ is not recognized

Make sure MinGW-w64 is installed and its "bin" directory is added to your system PATH. Restart the terminal after updating PATH.

Port 8080 is already in use

Close any other application using port 8080 and restart ParkIt.

Page not loading

Make sure "ParkIt.exe" is running and that you launched it from the main project directory.

File not found error

Run "ParkIt.exe" from inside the cloned "ParkIt" directory. The backend loads the frontend files using relative paths.

---

Note: The current backend uses Windows-specific networking APIs. Running ParkIt on Linux, macOS, or Android requires adapting the backend first.