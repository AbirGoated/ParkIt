
#define WIN32_LEAN_AND_MEAN
#include <winsock2.h>
#include <iostream>
#include <string>
#include <vector>
#include <memory>
#include <chrono>
#include <cmath>
#include <sstream>
#include <algorithm>
#include <cctype>
#include <cstdio>
#include <cstdlib>
#pragma comment(lib, "Ws2_32.lib")
using namespace std;
using namespace chrono;

const int PORT = 8080;
const int TOTAL_SLOTS = 20;

class Vehicle
{
protected:
    string registration;
    steady_clock::time_point entryTime;

public:
    Vehicle(string reg)
    {
        registration = reg;
        entryTime = steady_clock::now();
    }

    virtual string getType() = 0;
    virtual int getRate() = 0;

    string getRegistration()
    {
        return registration;
    }

    double getElapsedSeconds()
    {
        return duration<double>(
            steady_clock::now() - entryTime
        ).count();
    }

    virtual ~Vehicle() {}
};

class Car : public Vehicle
{
public:
    Car(string reg) : Vehicle(reg) {}

    string getType() override
    {
        return "car";
    }

    int getRate() override
    {
        return 30;
    }
};

class Bike : public Vehicle
{
public:
    Bike(string reg) : Vehicle(reg) {}

    string getType() override
    {
        return "bike";
    }

    int getRate() override
    {
        return 15;
    }
};

class Billing
{
public:
    static int calculateHours(double seconds)
    {
        return max(1, (int)ceil(seconds / 10.0));
    }

    static int calculateAmount(int rate, double seconds)
    {
        return calculateHours(seconds) * rate;
    }
};

class ParkingSlot
{
public:
    int number;
    unique_ptr<Vehicle> vehicle;

    ParkingSlot(int n) : number(n) {}

    bool isOccupied()
    {
        return vehicle != nullptr;
    }
};

class ParkingLot
{
private:
    vector<ParkingSlot> slots;

public:
    ParkingLot()
    {
        for (int i = 1; i <= TOTAL_SLOTS; i++)
            slots.emplace_back(i);
    }

    int findVehicle(string reg)
    {
        for (int i = 0; i < (int)slots.size(); i++)
        {
            if (slots[i].vehicle &&
                slots[i].vehicle->getRegistration() == reg)
                return i;
        }

        return -1;
    }

    int park(string reg, string type)
    {
        if (findVehicle(reg) != -1)
            return -2;

        for (int i = 0; i < (int)slots.size(); i++)
        {
            if (!slots[i].isOccupied())
            {
                if (type == "car")
                    slots[i].vehicle = make_unique<Car>(reg);
                else if (type == "bike")
                    slots[i].vehicle = make_unique<Bike>(reg);
                else
                    return -3;

                return i;
            }
        }

        return -1;
    }

    string getSlotsJSON()
    {
        string result = "{\"slots\":[";

        for (int i = 0; i < (int)slots.size(); i++)
        {
            if (i > 0) result += ",";

            result += "{\"id\":" + to_string(slots[i].number);

            if (slots[i].vehicle)
            {
                Vehicle* v = slots[i].vehicle.get();
                double seconds = v->getElapsedSeconds();

                result += ",\"occupied\":true";
                result += ",\"reg\":\"" + v->getRegistration() + "\"";
                result += ",\"type\":\"" + v->getType() + "\"";
                result += ",\"rate\":" + to_string(v->getRate());
                result += ",\"elapsedSeconds\":" + to_string((int)seconds);
            }
            else
            {
                result += ",\"occupied\":false";
            }

            result += "}";
        }

        result += "]}";
        return result;
    }

    string searchJSON(string reg)
    {
        int index = findVehicle(reg);

        if (index == -1)
            return "{\"success\":false,\"message\":\"Vehicle not found\"}";

        Vehicle* v = slots[index].vehicle.get();
        double seconds = v->getElapsedSeconds();

        return "{\"success\":true"
            ",\"slot\":" + to_string(slots[index].number) +
            ",\"reg\":\"" + v->getRegistration() +
            "\",\"type\":\"" + v->getType() +
            "\",\"rate\":" + to_string(v->getRate()) +
            ",\"elapsedSeconds\":" + to_string((int)seconds) +
            ",\"hours\":" + to_string(Billing::calculateHours(seconds)) +
            ",\"amount\":" + to_string(Billing::calculateAmount(v->getRate(), seconds)) +
            "}";
    }

    string exitVehicle(string reg)
    {
        int index = findVehicle(reg);

        if (index == -1)
            return "{\"success\":false,\"message\":\"Vehicle not found\"}";

        Vehicle* v = slots[index].vehicle.get();

        double seconds = v->getElapsedSeconds();
        int hours = Billing::calculateHours(seconds);
        int amount = Billing::calculateAmount(v->getRate(), seconds);
        int slotNumber = slots[index].number;
        int simulatedMinutes = (int)(seconds * 6);

        string result =
            "{\"success\":true"
            ",\"reg\":\"" + v->getRegistration() +
            "\",\"type\":\"" + v->getType() +
            "\",\"slot\":" + to_string(slotNumber) +
            ",\"rate\":" + to_string(v->getRate()) +
            ",\"elapsedSeconds\":" + to_string((int)seconds) +
            ",\"simulatedMinutes\":" + to_string(simulatedMinutes) +
            ",\"hours\":" + to_string(hours) +
            ",\"amount\":" + to_string(amount) +
            "}";

        slots[index].vehicle.reset();

        return result;
    }
};

class ParkingManager
{
private:
    ParkingLot lot;

    string normalise(string value)
    {
        transform(value.begin(), value.end(), value.begin(),
            [](unsigned char c) { return (char)toupper(c); });

        return value;
    }

public:
    string getSlots()
    {
        return lot.getSlotsJSON();
    }

    string parkVehicle(string reg, string type)
    {
        reg = normalise(reg);
        transform(type.begin(), type.end(), type.begin(),
            [](unsigned char c) { return (char)tolower(c); });

        if (reg.empty())
            return "{\"success\":false,\"message\":\"Registration is required\"}";

        int result = lot.park(reg, type);

        if (result == -2)
            return "{\"success\":false,\"message\":\"This vehicle is already parked\"}";

        if (result == -1)
            return "{\"success\":false,\"message\":\"Parking lot is full\"}";

        if (result == -3)
            return "{\"success\":false,\"message\":\"Invalid vehicle type\"}";

        return "{\"success\":true,\"slot\":" + to_string(result + 1) +
            ",\"reg\":\"" + reg + "\"}";
    }

    string searchVehicle(string reg)
    {
        return lot.searchJSON(normalise(reg));
    }

    string exitVehicle(string reg)
    {
        return lot.exitVehicle(normalise(reg));
    }
};

string urlDecode(string value)
{
    string result;

    for (size_t i = 0; i < value.length(); i++)
    {
        if (value[i] == '+')
            result += ' ';
        else if (value[i] == '%' && i + 2 < value.length())
        {
            string hex = value.substr(i + 1, 2);
            result += (char)strtol(hex.c_str(), nullptr, 16);
            i += 2;
        }
        else
            result += value[i];
    }

    return result;
}

string getParameter(string data, string key)
{
    stringstream ss(data);
    string item;

    while (getline(ss, item, '&'))
    {
        size_t pos = item.find('=');

        if (pos == string::npos)
            continue;

        string name = urlDecode(item.substr(0, pos));
        string value = urlDecode(item.substr(pos + 1));

        if (name == key)
            return value;
    }

    return "";
}

string getMimeType(string path)
{
    if (path.size() >= 5 && path.substr(path.size() - 5) == ".html")
        return "text/html";
    if (path.size() >= 4 && path.substr(path.size() - 4) == ".css")
        return "text/css";
    if (path.size() >= 3 && path.substr(path.size() - 3) == ".js")
        return "application/javascript";

    return "text/plain";
}

void sendResponse(SOCKET client, int status, string type, string body)
{
    string statusText = status == 200 ? "OK" :
                        status == 400 ? "Bad Request" :
                        status == 404 ? "Not Found" : "Error";

    string response =
        "HTTP/1.1 " + to_string(status) + " " + statusText + "\r\n" +
        "Content-Type: " + type + "; charset=utf-8\r\n" +
        "Content-Length: " + to_string(body.size()) + "\r\n" +
        "Connection: close\r\n\r\n" +
        body;

    send(client, response.c_str(), (int)response.size(), 0);
}

string readFile(string filename)
{
    FILE* file = fopen(filename.c_str(), "rb");

    if (!file)
        return "";

    fseek(file, 0, SEEK_END);
    long size = ftell(file);
    rewind(file);

    string content(size, '\0');
    fread(&content[0], 1, size, file);
    fclose(file);

    return content;
}

void handleClient(SOCKET client, ParkingManager& manager)
{
    string request;
    char buffer[4096];

    size_t headerEnd = string::npos;
    int contentLength = 0;

    while (true)
    {
        int received = recv(client, buffer, sizeof(buffer), 0);

        if (received <= 0)
            break;

        request.append(buffer, received);

        if (headerEnd == string::npos)
        {
            headerEnd = request.find("\r\n\r\n");

            if (headerEnd != string::npos)
            {
                string headers = request.substr(0, headerEnd);

                size_t pos = headers.find("Content-Length:");

                if (pos != string::npos)
                {
                    pos += 15;
                    contentLength = stoi(headers.substr(pos));
                }
            }
        }

        if (headerEnd != string::npos &&
            request.size() >= headerEnd + 4 + contentLength)
            break;
    }

    if (headerEnd == string::npos){
        sendResponse(client, 400, "text/plain", "Invalid request");
        return;
    }

    string headers = request.substr(0, headerEnd);
    string body = request.substr(headerEnd + 4, contentLength);

    stringstream firstLine(headers);
    string method, path, protocol;
    firstLine >> method >> path >> protocol;

    size_t queryPosition = path.find('?');
    string query = "";

    if (queryPosition != string::npos){
        query = path.substr(queryPosition + 1);
        path = path.substr(0, queryPosition);
    }

    if (method == "GET" && path == "/api/slots"){
        sendResponse(client, 200, "application/json", manager.getSlots());
    }
    else if (method == "POST" && path == "/api/park"){
        string reg = getParameter(body, "reg");
        string type = getParameter(body, "type");

        sendResponse(client, 200, "application/json",
            manager.parkVehicle(reg, type));
    }
    else if (method == "GET" && path == "/api/search"){
        string reg = getParameter(query, "reg");

        sendResponse(client, 200, "application/json",
            manager.searchVehicle(reg));
    }
    else if (method == "POST" && path == "/api/exit"){
        string reg = getParameter(body, "reg");

        sendResponse(client, 200, "application/json",
            manager.exitVehicle(reg));
    }
    else if (method == "GET"){
        if (path == "/")
            path = "/index.html";

        if (path != "/index.html" &&
            path != "/style.css" &&
            path != "/script.js"){
            sendResponse(client, 404, "text/plain", "Not found");
        }
        else{
            string content = readFile("." + path);

            if (content.empty())
                sendResponse(client, 404, "text/plain",
                    "File not found. Run ParkIt from its main folder.");
            else
                sendResponse(client, 200, getMimeType(path), content);
        }
    }
    else{
        sendResponse(client, 404, "text/plain", "Not found");
    }
}

int main(){
    WSADATA wsa;

    if (WSAStartup(MAKEWORD(2, 2), &wsa) != 0){
        cout << "Networking initialization failed." << endl;
        return 1;
    }

    SOCKET serverSocket = socket(AF_INET, SOCK_STREAM, 0);

    if (serverSocket == INVALID_SOCKET){
        cout << "Could not create server socket." << endl;
        WSACleanup();
        return 1;
    }
    sockaddr_in serverAddress{};
    serverAddress.sin_family = AF_INET;
    serverAddress.sin_addr.s_addr = htonl(INADDR_LOOPBACK);
    serverAddress.sin_port = htons(PORT);
    if (bind(serverSocket, (sockaddr*)&serverAddress,
        sizeof(serverAddress)) == SOCKET_ERROR){
        cout << "Could not use port " << PORT
             << ". Is another ParkIt server running?" << endl;
        closesocket(serverSocket);
        WSACleanup();
        return 1;
    }
    if (listen(serverSocket, SOMAXCONN) == SOCKET_ERROR){
        cout << "Could not start listening." << endl;
        closesocket(serverSocket);
        WSACleanup();
        return 1;
    }
    ParkingManager manager;
    cout << "\nParkIt C++ backend is running." << endl;
    cout << "Open http://localhost:" << PORT << " in your browser." << endl;
    cout << "Keep this terminal open while using ParkIt." << endl;
    cout << "Press Ctrl+C to stop.\n" << endl;
    while (true)
    {
        SOCKET client = accept(serverSocket, nullptr, nullptr);
        if (client == INVALID_SOCKET)
            continue;
        handleClient(client, manager);
        closesocket(client);
    }
    closesocket(serverSocket);
    WSACleanup();
    return 0;
}