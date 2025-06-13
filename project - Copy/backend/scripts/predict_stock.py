import sys
import json
import numpy as np
from tensorflow.keras.models import load_model
from joblib import load
import os

def predict_stock(model_path, data):
    # Load model and scaler
    model = load_model(model_path)
    scaler = load(os.path.join(os.path.dirname(model_path), 'scaler.joblib'))
    
    # Extract features from historical data
    historical_data = data['historicalData']
    stock_id = data['stockId']
    
    # Prepare features (assuming historical data contains daily stock levels)
    features = np.array(historical_data[-7:])  # Use last 7 days
    features = features.reshape(1, -1)
    
    # Scale features
    features_scaled = scaler.transform(features)
    
    # Make prediction
    prediction = model.predict(features_scaled)[0][0]
    
    # Round to nearest integer and ensure non-negative
    predicted_stock = max(0, round(float(prediction)))
    
    # Determine stock status
    status = 'normal'
    if predicted_stock <= 10:
        status = 'warning'
    if predicted_stock <= 5:
        status = 'critical'
    
    return {
        'stockId': stock_id,
        'predictedLevel': predicted_stock,
        'status': status,
        'recommendedOrder': max(0, 50 - predicted_stock) if predicted_stock < 20 else 0
    }

if __name__ == '__main__':
    if len(sys.argv) < 3:
        print(json.dumps({
            'error': 'Missing required arguments'
        }))
        sys.exit(1)
        
    try:
        model_path = sys.argv[1]
        input_data = json.loads(sys.argv[2])
        
        result = predict_stock(model_path, input_data)
        print(json.dumps(result))
        sys.exit(0)
        
    except Exception as e:
        print(json.dumps({
            'error': str(e)
        }))
        sys.exit(1)
