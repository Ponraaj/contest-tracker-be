import json
from datetime import datetime, timedelta


def generate_contests(start_weekly, start_biweekly, years=100):
    contests = []
    weekly_number = 436  # Given starting weekly contest number
    biweekly_number = 149  # Given starting biweekly contest number

    current_weekly = datetime.strptime(start_weekly, "%d/%m/%Y")
    current_biweekly = datetime.strptime(start_biweekly, "%d/%m/%Y")

    end_date = current_weekly.replace(year=current_weekly.year + years)

    while current_weekly < end_date or current_biweekly < end_date:
        if current_weekly < end_date:
            contests.append({
                "contest": f"weekly-contest-{weekly_number}",
                "date": current_weekly.strftime("%d/%m/%Y")
            })
            weekly_number += 1
            current_weekly += timedelta(days=7)  # Next Sunday

        if current_biweekly < end_date:
            contests.append({
                "contest": f"biweekly-contest-{biweekly_number}",
                "date": current_biweekly.strftime("%d/%m/%Y")
            })
            biweekly_number += 1
            current_biweekly += timedelta(days=14)  # Next alternate Saturday

    # Sort contests in ascending order by date
    contests.sort(key=lambda x: datetime.strptime(x["date"], "%d/%m/%Y"))

    return contests

# Start from given example dates
start_weekly = "02/02/2025"  # Sunday
start_biweekly = "01/02/2025"  # Saturday

# Generate contest schedule
contests = generate_contests(start_weekly, start_biweekly)

# Save to JSON file
with open("contests.json", "w") as file:
    json.dump(contests, file, indent=4)

print("Sorted contest schedule for the next 100 years has been generated and saved to 'contests_schedule.json'.")

