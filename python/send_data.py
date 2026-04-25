import serial
import requests

API_KEY = "CUTK94X780S2ES6G"

ser = serial.Serial('COM7', 9600)

while True:
    line = ser.readline().decode().strip()
    
    print("Data:", line)

    try:
        ldr, motion, gas = line.split(",")

        url = "https://api.thingspeak.com/update"
        
        data = {
            "api_key": API_KEY,
            "field1": ldr,
            "field2": motion,
            "field3": gas
        }

        requests.get(url, params=data)

        print("Sent to ThingSpeak")

    except:
        print("Error")