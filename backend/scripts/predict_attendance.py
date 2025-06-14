import sys
import json
import numpy as np
from tensorflow.keras.models import load_model
from joblib import load
import os

def predict_attendance(model_path, data):
    # Load model and scaler
    model = load_model(model_path)
    scaler = load(os.path.join(os.path.dirname(model_path), 'scaler.joblib'))
    
    # Extract features
    scheduled_time = data['scheduledTime']  # Expected format: "HH:MM"
    day = data['day']  # 0-6 for Monday-Sunday
    weather = data['weather']  # Weather condition string
    
    # Convert time to minutes since midnight
    hours, minutes = map(int, scheduled_time.split(':'))
    time_minutes = hours * 60 + minutes
    
    # One-hot encode day of week
    day_one_hot = np.zeros(7)
    day_one_hot[day] = 1
    
    # Create feature vector
    features = np.array([
        time_minutes,
        *day_one_hot,
        1 if weather in ['Rain', 'Thunderstorm'] else 0,  # Bad weather
        1 if weather in ['Clear', 'Clouds'] else 0,  # Good weather
    ]).reshape(1, -1)
    
    # Scale features
    features_scaled = scaler.transform(features)
    
    # Make prediction
    prediction = model.predict(features_scaled)[0][0]
    
    # Convert to probability and prepare response
    probability = float(prediction)
    is_likely_late = probability > 0.5
    
    return {
        'isLikelyLate': is_likely_late,
        'probability': probability,
        'toleranceMinutes': 15 if is_likely_late else 5  # Adjust tolerance based on prediction
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
        
        result = predict_attendance(model_path, input_data)
        print(json.dumps(result))
        sys.exit(0)
        
    except Exception as e:
        print(json.dumps({
            'error': str(e)
        }))
        sys.exit(1)
