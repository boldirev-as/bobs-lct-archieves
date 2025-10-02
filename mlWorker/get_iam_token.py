import requests
import os

def get_fresh_iam_token():
    """Получает IAM токен из переменных окружения или обновляет его через OAuth"""
    # Сначала пробуем получить из .env
    iam_token = os.getenv('YANDEX_IAM_TOKEN')
    oauth_token = os.getenv('YANDEX_OAUTH_TOKEN')
    
    # Если есть OAuth токен, пробуем получить новый IAM токен
    if oauth_token and oauth_token.strip():
        try:
            response = requests.post(
                'https://iam.api.cloud.yandex.net/iam/v1/tokens',
                json={'yandexPassportOauthToken': oauth_token}
            )
            
            if response.status_code == 200:
                data = response.json()
                new_iam_token = data['iamToken']
                expires_at = data['expiresAt']
                print(f"New IAM token obtained, expires at: {expires_at}")
                return new_iam_token
            else:
                print(f"Failed to get new IAM token: {response.status_code}")
        except Exception as e:
            print(f"Error getting new IAM token: {e}")
    
    # Возвращаем токен из переменных окружения
    return iam_token
