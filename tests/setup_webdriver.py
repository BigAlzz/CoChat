import os
import sys
import requests
import zipfile
import shutil
from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options

def get_chrome_version():
    """Get the installed Chrome version."""
    try:
        # For Windows, check the registry
        import winreg
        key = winreg.OpenKey(winreg.HKEY_CURRENT_USER, r"Software\Google\Chrome\BLBeacon")
        version = winreg.QueryValueEx(key, "version")[0]
        return version  # Return full version
    except:
        return "132.0.6834.160"  # Default to current version if we can't detect

def download_chromedriver():
    """Download ChromeDriver for Windows."""
    try:
        # Create drivers directory
        driver_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'drivers')
        os.makedirs(driver_dir, exist_ok=True)
        
        # Use the current Chrome version
        driver_version = get_chrome_version()
        download_url = f"https://edgedl.me.gvt1.com/edgedl/chrome/chrome-for-testing/{driver_version}/win64/chromedriver-win64.zip"
        
        # Download ChromeDriver
        print(f"Downloading ChromeDriver from {download_url}")
        response = requests.get(download_url)
        if response.status_code != 200:
            print(f"Failed to download ChromeDriver. Status code: {response.status_code}")
            # Try alternative version format (major.minor.build.patch)
            major_version = driver_version.split('.')[0]
            alt_version = f"{major_version}.0.6834.160"
            alt_url = f"https://edgedl.me.gvt1.com/edgedl/chrome/chrome-for-testing/{alt_version}/win64/chromedriver-win64.zip"
            print(f"Trying alternative URL: {alt_url}")
            response = requests.get(alt_url)
            if response.status_code != 200:
                return None
            
        # Save and extract
        zip_path = os.path.join(driver_dir, "chromedriver.zip")
        with open(zip_path, 'wb') as f:
            f.write(response.content)
            
        # Extract the zip file
        with zipfile.ZipFile(zip_path, 'r') as zip_ref:
            zip_ref.extractall(driver_dir)
            
        # Clean up
        os.remove(zip_path)
        
        # The chromedriver is now in a subdirectory, move it up
        chromedriver_dir = os.path.join(driver_dir, "chromedriver-win64")
        driver_path = os.path.join(chromedriver_dir, "chromedriver.exe")
        final_path = os.path.join(driver_dir, "chromedriver.exe")
        
        if os.path.exists(driver_path):
            # Move the chromedriver.exe to the drivers directory
            shutil.move(driver_path, final_path)
            # Remove the now-empty subdirectory
            shutil.rmtree(chromedriver_dir)
            print(f"ChromeDriver extracted to: {final_path}")
            return final_path
        else:
            print(f"ChromeDriver not found at expected path: {driver_path}")
            return None
        
    except Exception as e:
        print(f"Error downloading ChromeDriver: {str(e)}")
        return None

def setup_chromedriver():
    """Set up ChromeDriver for Windows."""
    try:
        # Download ChromeDriver
        driver_path = download_chromedriver()
        if not driver_path:
            return False
            
        print(f"ChromeDriver downloaded to: {driver_path}")
        
        # Test the ChromeDriver
        options = Options()
        options.add_argument('--headless')
        options.add_argument('--no-sandbox')
        options.add_argument('--disable-dev-shm-usage')
        options.add_argument('--disable-gpu')
        
        service = Service(executable_path=driver_path)
        driver = webdriver.Chrome(service=service, options=options)
        driver.quit()
        
        print("ChromeDriver setup successful!")
        return True
        
    except Exception as e:
        print(f"Error setting up ChromeDriver: {str(e)}")
        return False

if __name__ == '__main__':
    if setup_chromedriver():
        print("Setup completed successfully")
    else:
        print("Setup failed")
        sys.exit(1) 