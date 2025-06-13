# Sistem Prediksi Keterlambatan Karyawan

## Deskripsi

Sistem prediksi keterlambatan karyawan adalah modul machine learning yang digunakan untuk memprediksi kemungkinan keterlambatan karyawan berdasarkan berbagai faktor seperti cuaca, hari, dan pola historis. Sistem ini menggunakan model deep learning berbasis TensorFlow untuk menganalisa pola kehadiran dan memberikan toleransi waktu yang dinamis berdasarkan kondisi cuaca.

## Arsitektur Sistem

- **Teknologi**: TensorFlow, Flask, NumPy
- **Komponen**:
  - Model prediksi berbasis deep learning
  - API endpoint untuk prediksi
  - Integrasi dengan API cuaca
  - Data preprocessing dan normalisasi

### Flow Data

1. **Prediksi Keterlambatan**

   ```mermaid
   sequenceDiagram
       User->>Front-End: Input data absensi
       Front-End->>Back-End: POST /api/attendance
       Back-End->>Weather API: Get weather data
       Back-End->>ML Service: Request prediction
       ML Service->>Back-End: Return prediction
       Back-End->>Front-End: Return response
       Front-End->>User: Display result
   ```

2. **Monitoring Kehadiran**
   ```mermaid
   sequenceDiagram
       Admin->>Front-End: Access dashboard
       Front-End->>Back-End: GET /api/attendance
       Back-End->>Database: Query data
       Back-End->>ML Service: Batch analysis
       ML Service->>Back-End: Return analysis
       Back-End->>Front-End: Return data
       Front-End->>Admin: Display dashboard
   ```

## 📚 Overview

Proyek ini mengimplementasikan sistem prediksi keterlambatan karyawan yang mempertimbangkan:

- Data historis kehadiran karyawan
- Kondisi cuaca real-time
- Model machine learning berbasis TensorFlow
- Aturan toleransi dinamis berbasis cuaca

## 🌟 Fitur Utama

1. **Prediksi Keterlambatan**

   - Analisis pola kehadiran historis
   - Integrasi dengan data cuaca real-time
   - Perhitungan toleransi otomatis

2. **Faktor Analisis**

   - Hari dalam seminggu
   - Waktu jadwal & kedatangan
   - Kondisi cuaca (Clear, Clouds, Rain, Thunderstorm)
   - Pola keterlambatan historis

3. **Sistem Toleransi Dinamis**
   - 5 menit untuk kondisi hujan/badai
   - 1 menit untuk cuaca cerah/berawan

## 🛠️ Tech Stack

- **Machine Learning**: TensorFlow, Keras
- **Data Processing**: Pandas, NumPy
- **Data Preprocessing**: Scikit-learn
- **Data Visualization**: Matplotlib, Seaborn

## 📊 Model Performance

- Training Accuracy: >95%
- Validation Accuracy: >95%
- Loss Function: Binary Crossentropy
- Optimizer: Adam (learning_rate=0.001)

## 📋 Requirements

```
pandas
numpy
tensorflow
scikit-learn
matplotlib
seaborn
```

## 🚀 Cara Penggunaan

```python
hasil = prediksi_kehadiran(
    hari_string='Monday',      # Hari (dalam bahasa Inggris)
    jam_jadwal='09:00:00',    # Format waktu HH:MM:SS
    kondisi_cuaca='Rain',      # Clear/Clouds/Rain/Thunderstorm
    jam_masuk='09:02:00'      # Opsional, waktu kedatangan aktual
)
```

### Output Prediksi

```python
{
    'probabilitas_prediksi': 0.85,      # Probabilitas keterlambatan
    'kondisi_cuaca': 'Rain',            # Kondisi cuaca saat ini
    'toleransi_menit': 5,               # Toleransi yang diberikan (menit)
    'kemungkinan_terlambat': False,     # Status keterlambatan
    'waktu_jadwal': '09:00:00',         # Waktu jadwal
    'waktu_kedatangan': '09:02:00',     # Waktu kedatangan
    'selisih_menit': 2                  # Selisih waktu (menit)
}
```

## 📁 Struktur Project

```
absensi/
├── bismillah_[CAPSTONE]_absensi.ipynb  # Notebook utama
├── clean_absensi.csv                   # Dataset yang sudah dibersihkan
├── model_metadata.json                 # Metadata model
├── model.h5                           # Model terlatih
├── requirements.txt                   # Dependency
└── scaler.joblib                     # Scaler untuk preprocessing
```

## 📈 Visualisasi

Model ini menyediakan visualisasi untuk:

- Distribusi data keterlambatan
- Korelasi antar variabel
- Performa model (accuracy & loss)
- Prediksi vs aktual

## 🔄 Cara Kerja Program

### 1. Preprocessing Data

1. **Data Loading**

   - Membaca file CSV yang berisi data historis absensi
   - Mengkonversi format tanggal dan waktu
   - Menghilangkan missing values dan duplikat

2. **Feature Engineering**

   - Konversi waktu ke menit (waktu kedatangan dan jadwal)
   - Ekstraksi fitur hari (weekday/weekend)
   - One-hot encoding untuk kondisi cuaca
   - Perhitungan pola keterlambatan historis

3. **Data Splitting & Scaling**
   - Pembagian data training (80%) dan testing (20%)
   - Standardisasi fitur menggunakan StandardScaler

### 2. Model Architecture

1. **Input Layer**
   - 8 input features (waktu, hari, cuaca)
2. **Hidden Layers**

   - Dense Layer 1: 64 neurons + ReLU
   - Batch Normalization + Dropout (0.3)
   - Dense Layer 2: 32 neurons + ReLU
   - Batch Normalization + Dropout (0.3)
   - Dense Layer 3: 16 neurons + ReLU
   - Batch Normalization + Dropout (0.3)

3. **Output Layer**
   - Single neuron dengan sigmoid activation
   - Binary classification (terlambat/tidak)

### 3. Training Process

1. **Optimizer**: Adam (learning_rate=0.001)
2. **Loss Function**: Binary Crossentropy
3. **Metrics**: Accuracy
4. **Early Stopping**: When accuracy > 95%
5. **Batch Size**: 32
6. **Maximum Epochs**: 100

### 4. Prediksi Real-time

1. **Input Processing**

   - Konversi format waktu ke menit
   - Encoding hari dan cuaca
   - Standardisasi fitur

2. **Toleransi Dinamis**

   - Cuaca hujan/badai: 5 menit
   - Cuaca cerah/berawan: 1 menit

3. **Output Generation**
   - Probabilitas keterlambatan
   - Status (terlambat/tepat waktu)
   - Informasi waktu dan selisih
   - Toleransi yang diberikan

### 5. Integrasi dengan Sistem

1. **API Endpoint**

   - Menerima data absensi real-time
   - Mengambil data cuaca terkini
   - Memberikan prediksi dan toleransi

2. **Database Integration**

   - Menyimpan hasil prediksi
   - Mengupdate pola historis
   - Tracking performa model

3. **Monitoring**
   - Visualisasi distribusi keterlambatan
   - Analisis faktor-faktor pengaruh
   - Evaluasi akurasi prediksi

## Komponen Sistem

### 1. Model Machine Learning

- **File Model**: `absensi/model.h5`
- **Scaler**: `absensi/scaler.joblib`
- **Metadata**: `absensi/model_metadata.json`

### 2. API Endpoint

- **Path**: `/predict`
- **Method**: POST
- **Server**: Flask (Python)

## Input Format

```json
{
  "hari": "string",
  "jam_jadwal": "string (HH:MM:SS)",
  "jam_masuk": "string (HH:MM:SS)",
  "kondisi_cuaca": "string",
  "latitude": "float",
  "longitude": "float"
}
```

### Parameter Input

| Parameter     | Tipe   | Deskripsi                                      |
| ------------- | ------ | ---------------------------------------------- |
| hari          | string | Hari dalam bahasa Inggris (Monday-Sunday)      |
| jam_jadwal    | string | Waktu jadwal format HH:MM:SS                   |
| jam_masuk     | string | Waktu kedatangan format HH:MM:SS               |
| kondisi_cuaca | string | Kondisi cuaca (Clear/Clouds/Rain/Thunderstorm) |
| latitude      | float  | Koordinat latitude lokasi                      |
| longitude     | float  | Koordinat longitude lokasi                     |

## Output Format

```json
{
  "prediction": {
    "probabilitas_prediksi": "float",
    "kondisi_cuaca": "string",
    "toleransi_menit": "integer",
    "kemungkinan_terlambat": "boolean",
    "waktu_jadwal": "string",
    "waktu_kedatangan": "string",
    "selisih_menit": "integer"
  },
  "status": "success"
}
```

### Parameter Output

| Parameter             | Tipe    | Deskripsi                         |
| --------------------- | ------- | --------------------------------- |
| probabilitas_prediksi | float   | Probabilitas keterlambatan (0-1)  |
| kondisi_cuaca         | string  | Kondisi cuaca saat ini            |
| toleransi_menit       | integer | Toleransi yang diberikan (menit)  |
| kemungkinan_terlambat | boolean | Status keterlambatan (true/false) |
| waktu_jadwal          | string  | Waktu jadwal format HH:MM:SS      |
| waktu_kedatangan      | string  | Waktu kedatangan format HH:MM:SS  |
| selisih_menit         | integer | Selisih waktu kedatangan (menit)  |

## Tampilan Web

### Dashboard Kehadiran

```
Status Kehadiran Hari Ini:
✅ Tepat Waktu (X karyawan)
⚠️ Terlambat (Y karyawan)

Tabel Kehadiran:
| Nama | Jadwal | Kedatangan | Cuaca | Status | Toleransi |
|------|---------|------------|--------|---------|------------|
| A    | 09:00   | 09:02      | Rain   | ✅      | 5 menit    |
| B    | 08:00   | 08:30      | Clear  | ⚠️      | 1 menit    |
```

## Best Practices

1. **Monitoring Kehadiran**

   - Cek pola keterlambatan harian
   - Evaluasi dampak cuaca terhadap keterlambatan
   - Review efektivitas toleransi

2. **Pengelolaan Data**

   - Update data cuaca secara real-time
   - Validasi lokasi kehadiran
   - Maintenance historical data

3. **Sistem Toleransi**
   - Evaluasi kebijakan toleransi secara berkala
   - Sesuaikan dengan kondisi cuaca ekstrem
   - Monitor efektivitas toleransi
