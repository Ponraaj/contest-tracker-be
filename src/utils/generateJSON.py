import json
from datetime import datetime, timedelta
from typing import List, TypedDict

import pytz


class Contest(TypedDict):
    contest: str
    date: str
    type: str

def generate_contests(start_weekly: str, start_biweekly: str, years: int = 100) -> List[Contest]:
    """
    Generate a schedule of LeetCode contests with proper UTC timestamps.
    
    Args:
        start_weekly (str): Start date for weekly contests (format: DD/MM/YYYY)
        start_biweekly (str): Start date for biweekly contests (format: DD/MM/YYYY)
        years (int): Number of years to generate contests for
        
    Returns:
        List[Contest]: List of contest dictionaries with name, ISO date, and type
    """
    contests: List[Contest] = []
    weekly_number = 436  # Starting weekly contest number
    biweekly_number = 149  # Starting biweekly contest number
    
    # Create timezone-aware datetime objects
    ist = pytz.timezone('Asia/Kolkata')
    
    # Parse input dates
    current_weekly = datetime.strptime(start_weekly, "%d/%m/%Y")
    current_weekly = ist.localize(current_weekly.replace(hour=10, minute=0))  # 10:00 AM IST
    
    current_biweekly = datetime.strptime(start_biweekly, "%d/%m/%Y")
    current_biweekly = ist.localize(current_biweekly.replace(hour=22, minute=0))  # 10:00 PM IST
    
    # Calculate end date
    end_date = current_weekly.replace(year=current_weekly.year + years)
    
    # Generate contests
    while current_weekly < end_date or current_biweekly < end_date:
        if current_weekly < end_date:
            contests.append({
                "contest": f"weekly-contest-{weekly_number}",
                "date": current_weekly.isoformat(),
                "type": "weekly"
            })
            weekly_number += 1
            current_weekly += timedelta(days=7)  # Next Sunday
        
        if current_biweekly < end_date:
            contests.append({
                "contest": f"biweekly-contest-{biweekly_number}",
                "date": current_biweekly.isoformat(),
                "type": "biweekly"
            })
            biweekly_number += 1
            current_biweekly += timedelta(days=14)  # Next alternate Saturday
    
    # Sort contests by date
    contests.sort(key=lambda x: x["date"])
    return contests

def validate_dates(weekly_date: str, biweekly_date: str) -> bool:
    """
    Validate that weekly contests fall on Sundays and biweekly on Saturdays.
    
    Args:
        weekly_date (str): Weekly contest start date
        biweekly_date (str): Biweekly contest start date
        
    Returns:
        bool: True if dates are valid, False otherwise
    """
    weekly = datetime.strptime(weekly_date, "%d/%m/%Y")
    biweekly = datetime.strptime(biweekly_date, "%d/%m/%Y")
    
    if weekly.weekday() != 6:  # Sunday is 6
        print(f"Error: Weekly contest must start on Sunday. {weekly_date} is a {weekly.strftime('%A')}")
        return False
        
    if biweekly.weekday() != 5:  # Saturday is 5
        print(f"Error: Biweekly contest must start on Saturday. {biweekly_date} is a {biweekly.strftime('%A')}")
        return False
        
    return True

def main():
    """
    Main function to generate and save contest schedule.
    """
    # Start dates
    start_weekly = "02/02/2025"    # Sunday
    start_biweekly = "01/02/2025"  # Saturday
    
    # Validate dates
    if not validate_dates(start_weekly, start_biweekly):
        return
    
    try:
        # Generate contests
        contests = generate_contests(start_weekly, start_biweekly)
        
        # Save to JSON file
        output_path = "./contests.json"
        with open(output_path, "w") as file:
            json.dump(contests, file, indent=2)
            
        print(f"Successfully generated {len(contests)} contests")
        print(f"Contest schedule has been saved to '{output_path}'")
        print(f"First contest: {contests[0]['contest']} on {contests[0]['date']}")
        print(f"Last contest: {contests[-1]['contest']} on {contests[-1]['date']}")
        
    except Exception as e:
        print(f"Error generating contests: {str(e)}")

if __name__ == "__main__":
    main()
