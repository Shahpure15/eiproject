import serial
import json
import time
import os

# Configuration
SERIAL_PORT = 'COM7'  # Update this to your Arduino's COM port
BAUD_RATE = 9600
DATA_FILE = 'data.json'
MAX_HISTORY = 80

def main():
    print(f"Connecting to {SERIAL_PORT}...")
    try:
        ser = serial.Serial(SERIAL_PORT, BAUD_RATE, timeout=1)
        time.sleep(2)  # Wait for connection to stabilize
        print("Connected!")
    except Exception as e:
        print(f"Error connecting to serial port: {e}")
        return

    # Ensure file exists immediately to prevent frontend fetch errors
    if not os.path.exists(DATA_FILE):
        with open(DATA_FILE, 'w') as f:
            json.dump({"feeds": []}, f, indent=4)
        print(f"Created initial {DATA_FILE}")

    # Initialize history list
    history = []

    # Load existing history if available
    if os.path.exists(DATA_FILE):
        try:
            with open(DATA_FILE, 'r') as f:
                data = json.load(f)
                history = data.get('feeds', [])
        except:
            history = []

    print("Reading data... Press Ctrl+C to stop.")
    
    try:
        while True:
            if ser.in_waiting > 0:
                line = ser.readline().decode('utf-8').strip()
                if not line:
                    continue
                
                print(f"Raw Data: {line}")
                
                try:
                    # Expected format: "ldr,motion,gas"
                    parts = line.split(',')
                    if len(parts) == 3:
                        ldr, motion, gas = parts
                        
                        # Create a feed entry similar to ThingSpeak format
                        new_entry = {
                            "created_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                            "field1": ldr,
                            "field2": motion,
                            "field3": gas
                        }
                        
                        history.append(new_entry)
                        
                        # Keep only the last MAX_HISTORY entries
                        if len(history) > MAX_HISTORY:
                            history = history[-MAX_HISTORY:]
                        
                        # Write to JSON file
                        with open(DATA_FILE, 'w') as f:
                            json.dump({"feeds": history}, f, indent=4)
                        
                        print(f"Logged: LDR={ldr}, PIR={motion}, Gas={gas}")
                except Exception as e:
                    print(f"Data parsing error: {e}")
            
            time.sleep(0.1)
    except KeyboardInterrupt:
        print("\nStopping...")
    finally:
        ser.close()

if __name__ == "__main__":
    main()
