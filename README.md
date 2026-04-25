# 🌆 Smart Street Light & AQI Monitoring System

A complete IoT-based smart system that monitors environmental conditions and controls street lighting intelligently using real-time data.

---

## 🚀 Live Website

https://avinashsingh539.github.io/smart-street-light-aqi-monitor/

---

## 🧠 System Architecture

Arduino collects sensor data and sends it to a Python script, which uploads it to ThingSpeak.
The website fetches this data and displays it in real-time.

### 🔄 Data Flow

Arduino → Serial Monitor → Python Script → ThingSpeak Cloud → Website Dashboard

---

## 📊 Features

* 📡 Real-time IoT data visualization
* 🌙 Smart street light automation (LDR + Motion)
* 💨 Air quality monitoring (MQ-2 Gas Sensor)
* 📈 Interactive graphs (Chart.js)
* 🔄 Auto-refresh every 5 seconds
* 🎨 Modern AQI-style UI
* ⚠️ Gas alert system

---

## 🛠️ Technologies Used

### 💻 Frontend

* HTML5
* CSS3
* JavaScript
* Chart.js

### ☁️ Cloud

* ThingSpeak API

### 🔌 Hardware

* Arduino UNO
* LDR Sensor
* PIR Motion Sensor
* MQ-2 Gas Sensor
* LED (Street Light)

### 🐍 Backend Script

* Python (Serial Communication + ThingSpeak Upload)

---

## 📂 Project Structure

smart-street-light-aqi/
│
├── index.html
├── style.css
├── script.js
├── README.md
│
├── python/
│   └── thingspeak_uploader.py
│
├── arduino/
│   └── smart_street_light.ino

---

## ⚙️ How It Works

* LDR detects light intensity
* PIR detects motion
* Gas sensor measures air quality
* Arduino sends values via serial
* Python reads serial and uploads to ThingSpeak
* Website fetches data using API and updates UI

---

## 🔗 ThingSpeak Channel

Channel ID: 3307818
Data Source: https://api.thingspeak.com/channels/3307818/feeds.json

---

## ▶️ Running the Project

### 1. Upload Arduino Code

* Open Arduino IDE
* Upload `.ino` file

### 2. Run Python Script

```bash
python send_data.py
```

### 3. Open Website

Open index.html OR use GitHub Pages link

---

## 👨‍💻 Developed By

**Avinash Vikas Singh and Team**
MIT Academy of Engineering
Course: Engineering Informatics

---

## 📜 License

All Rights Reserved © 2026
