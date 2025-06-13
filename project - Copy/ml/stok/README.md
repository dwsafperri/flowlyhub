# Sistem Prediksi Stok Barang

## Deskripsi

Sistem prediksi stok barang adalah modul machine learning yang digunakan untuk memprediksi status dan estimasi ketersediaan stok barang. Sistem ini menggunakan model deep learning berbasis TensorFlow untuk menganalisa pola penggunaan stok dan memberikan rekomendasi pengelolaan inventori.

## Arsitektur Sistem

- **Teknologi**: TensorFlow, Flask, NumPy
- **Komponen**:
  - Model prediksi berbasis deep learning
  - API endpoint untuk prediksi
  - Data preprocessing dan normalisasi
  - Model persistence dan versioning

### 4. Flow Data

1. **Input Data**

   ```mermaid
   sequenceDiagram
       User->>Front-End: Input data stok
       Front-End->>Back-End: POST /api/stock
       Back-End->>Database: Save data
       Back-End->>ML Service: Request prediction
       ML Service->>Back-End: Return prediction
       Back-End->>Front-End: Return response
       Front-End->>User: Display result
   ```

2. **Monitoring Stok**
   ```mermaid
   sequenceDiagram
       User->>Front-End: Access dashboard
       Front-End->>Back-End: GET /api/stock
       Back-End->>Database: Query data
       Back-End->>ML Service: Batch predictions
       ML Service->>Back-End: Return predictions
       Back-End->>Front-End: Return data
       Front-End->>User: Display dashboard
   ```

## Komponen Sistem

### 1. Model Machine Learning

- **File Model**: `stok/stok_model.h5`
- **Scaler**: `stok/scaler.joblib`
- **Metadata**: `stok/model_metadata.json`

### 2. API Endpoint

- **Path**: `/predict`
- **Method**: POST
- **Server**: Flask (Python)

## Input Format

```json
{
  "nama_barang": "string",
  "stok_awal": "integer",
  "masuk": "integer",
  "keluar": "integer",
  "bulan": "integer (1-12)"
}
```

### Parameter Input

| Parameter   | Tipe    | Deskripsi                      |
| ----------- | ------- | ------------------------------ |
| nama_barang | string  | Nama item yang akan diprediksi |
| stok_awal   | integer | Jumlah stok saat ini           |
| masuk       | integer | Jumlah barang yang masuk       |
| keluar      | integer | Jumlah barang yang keluar      |
| bulan       | integer | Bulan saat ini (1-12)          |

## Output Format

```json
{
  "prediction": {
    "nama_barang": "string",
    "stok_tersedia": "integer",
    "status": "string (Aman/Beresiko)",
    "estimasi_habis": "string",
    "probabilitas_habis": "float",
    "rekomendasi": "string"
  },
  "status": "success"
}
```

### Parameter Output

| Parameter          | Tipe    | Deskripsi                         |
| ------------------ | ------- | --------------------------------- |
| nama_barang        | string  | Nama barang yang diprediksi       |
| stok_tersedia      | integer | Jumlah stok yang tersedia         |
| status             | string  | Status stok ("Aman"/"Beresiko")   |
| estimasi_habis     | string  | Estimasi waktu habis dalam hari   |
| probabilitas_habis | float   | Probabilitas kehabisan stok (0-1) |
| rekomendasi        | string  | Rekomendasi tindakan              |

## Cara Kerja Sistem

1. **Input Data**

   - User memasukkan data barang melalui web interface
   - Data dikirim ke API endpoint `/predict`

2. **Preprocessing**

   - Data dinormalisasi menggunakan scaler
   - Fitur-fitur disiapkan untuk prediksi:
     - Stok movement
     - Depletion rate
     - Moving averages

3. **Prediksi**

   - Model ML memproses data
   - Menghasilkan probabilitas kehabisan stok
   - Menghitung estimasi hari tersisa

4. **Kriteria Status Stok**

   - Berisiko (At Risk)

     - Stok habis (stok = 0)
     - Stok tersisa kurang dari 7 hari
     - Prediksi risiko tinggi (>0.7)
     - Jumlah stok kurang dari 20% dari penggunaan

   - Stabil (Stable)

     - Tidak ada pengurangan stok (keluar = 0)
     - Masih memiliki stok
     - Tidak ada estimasi penipisan stok

   - Aman (Safe)
     - Tidak masuk kategori berisiko
     - Memiliki stok minimal untuk 7 hari ke depan
     - Prediksi risiko rendah
     - Jumlah stok lebih dari 20% dari penggunaan

5. **Output**

   - Status stok ditentukan berdasarkan threshold:
     - Aman: probabilitas < 0.5
     - Beresiko: probabilitas ≥ 0.5
   - Rekomendasi diberikan berdasarkan tingkat risiko:
     - Monitoring untuk status aman
     - Restock untuk status berisiko

Sistem mengkategorikan status stok menjadi 3 kategori berdasarkan beberapa parameter:

## Tampilan Web

### Dashboard Stok

```
Status Stok Hari ini:
🟢 Aman (X items)
🔴 Beresiko (Y items)

Tabel Stok:
| Nama Barang | Stok Tersedia | Satuan | Estimasi Habis | Status |
|-------------|--------------|---------|----------------|--------|
| Barang A    | 100          | Ekor    | 7 Hari        | Aman    |
| Barang B    | 50           | Sachet  | 3 Hari        | Beresiko|
```

## Best Practices

1. **Monitoring Stok**

   - Cek status stok secara rutin
   - Perhatikan barang dengan status "Beresiko"
   - Review estimasi habis untuk planning

2. **Restock Planning**

   - Gunakan estimasi hari untuk jadwal pemesanan
   - Pertimbangkan lead time supplier
   - Monitor tren penggunaan

3. **Data Quality**
   - Update data stok secara real-time
   - Pastikan input data akurat
   - Regular data cleaning
