#include <Arduino.h>
#include <Wire.h>
#include <SPI.h>
#include <SD.h>
#include <Adafruit_MPU6050.h>
#include <Adafruit_BME280.h>
#include <BH1750.h>
#include <TinyGPSPlus.h>

// Sensor objects
Adafruit_MPU6050 mpu;
Adafruit_BME280 bme;
BH1750 bhlight;
TinyGPSPlus gps;

// Uart 2: for gps, communicating with the esp gps port
HardwareSerial gpsSerial(2);

// SD chip select pin — usually GPIO 5 on ESP32
#define SD_CS 5

// Creates a log file
File logFile;

void initSensors(){
  Wire.begin(); // this sets to defualt with SDA=21 and SCL = 22
  if (!mpu.begin()) Serial.println("MPU6050 FAILURE");
  if (!bme.begin()) Serial.println("BME280 FAILURE");
  if (!bhlight.begin()) Serial.println("BH1750 FAILURE");
  gpsSerial.begin(9600, SERIAL_8N1, 16, 17); // baud rate, config, then puins

  // Set GPS to 10Hz update rate (this is just ai code cuz idk whats happeninig)
  gpsSerial.print("$PUBX,40,RMC,0,1,0,0,0,0*46\r\n");
  delay(100);
  gpsSerial.print("$PUBX,40,GGA,0,1,0,0,0,0*5B\r\n");
  delay(100);
}

void initSD(){
  if (!SD.begin(SD_CS)){
    Serial.println("SD FAILURE");
    return;
  }
  logFile = SD.open("/flight_log.csv", FILE_WRITE);
  if (logFile) {
    // This writes a header line
    logFile.println("time_ms,temp,humidity,pressure,lux,ax,ay,az,gx,gy,gz,lat,lng,gps_valid,altitude,speed");
    logFile.flush();
  }
}

struct SensorData{
  float temp, humidity, pressure, lux;
  float ax, ay, az;
  float gx, gy, gz;
  double lat, lng;
  float altitude, speed;
  bool gpsValid;
};

SensorData readSensors(){
  SensorData data;

  data.temp = bme.readTemperature();
  data.humidity = bme.readHumidity();
  data.pressure = bme.readPressure();

  data.lux = bhlight.readLightLevel();

  sensors_event_t accel;
  sensors_event_t gyro;
  sensors_event_t temp;
  mpu.getEvent(&accel, &gyro, &temp);
    
  data.ax = accel.acceleration.x;
  data.ay = accel.acceleration.y;
  data.az = accel.acceleration.z;

  data.gx = gyro.gyro.x;
  data.gy = gyro.gyro.y;
  data.gz = gyro.gyro.z;

  
  while (gpsSerial.available()) gps.encode(gpsSerial.read());
  data.gpsValid = gps.location.isValid();
  data.lat = data.gpsValid ? gps.location.lat() : 0;
  data.lng = data.gpsValid ? gps.location.lng() : 0;
  data.altitude = gps.altitude.isValid() ? gps.altitude.meters()  : 0;
  data.speed    = gps.speed.isValid()    ? gps.speed.kmph()       : 0;

  return data;
}


void logToSD(SensorData data){
  if (!logFile) return;

  
  logFile.printf("%lu,%.2f,%.2f,%.2f,%.2f,%.3f,%.3f,%.3f,%.3f,%.3f,%.3f,%.6f,%.6f,%d,%.2f,%.2f\n",
    millis(),
    data.temp, data.humidity, data.pressure, data.lux,
    data.ax, data.ay, data.az,
    data.gx, data.gy, data.gz,
    data.lat, data.lng, data.gpsValid,
    data.altitude, data.speed   
  );

  logFile.flush();
}


void setup() {
  // put your setup code here, to run once:
  Serial.begin(115200);
  initSensors();
  initSD();
}

void loop() {
  // put your main code here, to run repeatedly:
  SensorData data = readSensors();
  logToSD(data);
  delay(50); // 20Hz 
}