const int ledPin = 13;
const int ldrPin = A0;
const int gasPin = A1;
const int pirPin = 2;

unsigned long lastMotionTime = 0;
const long delayTime = 60000; // 1 minute

void setup()
{
          pinMode(ledPin, OUTPUT);
          pinMode(pirPin, INPUT);

          Serial.begin(9600);
}

void loop()
{

          int ldrValue = analogRead(ldrPin);
          int gasValue = analogRead(gasPin);
          int motion = digitalRead(pirPin);

          // 🔥 Motion timer
          if (motion == HIGH)
          {
                    lastMotionTime = millis();
          }

          // 🔥 Street light logic
          bool lightState = false;

          if (ldrValue <= 720 && (millis() - lastMotionTime < delayTime))
          {
                    digitalWrite(ledPin, HIGH);
                    lightState = true;
          }
          else
          {
                    digitalWrite(ledPin, LOW);
                    lightState = false;
          }

          // 🔥 IMPORTANT: SIMPLE FORMAT FOR PYTHON
          // Format: LDR,Motion,Gas
          Serial.print(ldrValue);
          Serial.print(",");
          Serial.print(motion);
          Serial.print(",");
          Serial.println(gasValue);

          delay(1000);
}