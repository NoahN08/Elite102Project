import sqlite3
import os
import random
from flask import Flask, render_template, request, session, redirect, url_for, flash
from flask_session import Session
from flask_cors import CORS
from werkzeug.security import generate_password_hash, check_password_hash
from functools import wraps
from datetime import timedelta

app = Flask(__name__, static_folder="static", template_folder="templates")
CORS(app)

# Session configuration
app.config.update(
    SECRET_KEY=os.urandom(24),
    SESSION_TYPE='filesystem',
    SESSION_PERMANENT=False,
    PERMANENT_SESSION_LIFETIME=timedelta(minutes=30)
)
Session(app)


def get_db():
    db = sqlite3.connect('banking.db')
    db.row_factory = sqlite3.Row
    return db


def init_db():
    try:
        # Only initialize if database doesn't exist
        if not os.path.exists('banking.db'):
            with app.app_context():
                db = get_db()
                with open('schema.sql', 'r') as f:
                    script = f.read()
                db.executescript(script)
                db.commit()
                db.close()
                print("Database initialized successfully")
    except Exception as e:
        print(f"Database initialization error: {e}")


def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user_id' not in session:
            return redirect(url_for('login'))
        return f(*args, **kwargs)
    return decorated_function


@app.route('/')
def home():
    return render_template('home.html')


@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        account_number = request.form['account_number']
        pin = request.form['pin']

        db = get_db()
        user = db.execute('SELECT * FROM users WHERE account_number = ?',
                         [account_number]).fetchone()

        if not user:
            flash('Account number not found')
            return render_template('login.html')
            
        if not check_password_hash(user['pin'], pin):
            flash('Invalid PIN')
            return render_template('login.html')
            
        session['user_id'] = user['id']
        session['is_admin'] = user['is_admin']
        return redirect(url_for('dashboard'))
    return render_template('login.html')


@app.route('/dashboard')
@login_required
def dashboard():
    db = get_db()
    accounts = db.execute('''
        SELECT * FROM accounts WHERE user_id = ? AND active = 1
    ''', [session['user_id']]).fetchall()
    return render_template('dashboard.html', accounts=accounts)


@app.route('/create_account', methods=['GET', 'POST'])
def create_account():
    if request.method == 'POST':
        name = request.form['name']
        pin = request.form['pin']
        
        # Generate unique account number
        account_number = str(random.randint(1000000000, 9999999999))
        
        db = get_db()
        hashed_pin = generate_password_hash(pin)
        
        try:
            db.execute('''
                INSERT INTO users (name, account_number, pin)
                VALUES (?, ?, ?)
            ''', [name, account_number, hashed_pin])
            
            user_id = db.execute('SELECT last_insert_rowid()').fetchone()[0]
            
            # Create initial checking account
            db.execute('''
                INSERT INTO accounts (user_id, account_type, balance)
                VALUES (?, 'checking', 0.00)
            ''', [user_id])
            
            db.commit()
            flash(f'Account created successfully! Your account number is {account_number}. Please save this number for logging in.')
            session['show_account'] = account_number
            return redirect(url_for('login'))
        except sqlite3.IntegrityError:
            flash('Error creating account. Please try again.')
            
    return render_template('create_account.html')

@app.route('/admin/accounts')
@login_required
def admin_accounts():
    if not session.get('is_admin', False):
        return redirect(url_for('dashboard'))
        
    db = get_db()
    accounts = db.execute('''
        SELECT users.*, accounts.* 
        FROM users 
        JOIN accounts ON users.id = accounts.user_id
        WHERE accounts.active = 1
    ''').fetchall()
    return render_template('admin_accounts.html', accounts=accounts)

@app.route('/admin/modify_account/<int:account_id>', methods=['POST'])
@login_required
def modify_account(account_id):
    if not session.get('is_admin', False):
        return redirect(url_for('dashboard'))
        
    action = request.form.get('action')
    db = get_db()
    
    if action == 'close':
        db.execute('UPDATE accounts SET active = 0 WHERE id = ?', [account_id])
        db.commit()
        flash('Account closed successfully')
    
    return redirect(url_for('admin_accounts'))


@app.route('/transaction', methods=['GET', 'POST'])
@login_required
def transaction():
    if request.method == 'POST':
        account_id = request.form['account_id']
        amount = float(request.form['amount'])
        transaction_type = request.form['type']

        db = get_db()
        account = db.execute('SELECT * FROM accounts WHERE id = ?',
                           [account_id]).fetchone()

        if transaction_type == 'withdraw' and account['balance'] < amount:
            flash('Insufficient funds')
            return redirect(url_for('transaction'))

        new_balance = account['balance'] + amount if transaction_type == 'deposit' \
                     else account['balance'] - amount

        db.execute('''
            UPDATE accounts SET balance = ? WHERE id = ?
        ''', [new_balance, account_id])

        db.execute('''
            INSERT INTO transactions (account_id, transaction_type, amount)
            VALUES (?, ?, ?)
        ''', [account_id, transaction_type, amount])

        db.commit()
        flash('Transaction completed successfully')
        return redirect(url_for('dashboard'))

    db = get_db()
    accounts = db.execute('''
        SELECT * FROM accounts WHERE user_id = ? AND active = 1
    ''', [session['user_id']]).fetchall()
    return render_template('transaction.html', accounts=accounts)



@app.route('/transaction_history')
@login_required
def transaction_history():
    db = get_db()
    user_accounts = db.execute('SELECT id FROM accounts WHERE user_id = ?', 
                             [session['user_id']]).fetchall()
    account_ids = [account['id'] for account in user_accounts]
    
    transactions = db.execute('''
        SELECT * FROM transactions 
        WHERE account_id IN ({})
        ORDER BY timestamp DESC
    '''.format(','.join('?' * len(account_ids))), account_ids).fetchall()
    
    return render_template('transaction_history.html', transactions=transactions)

@app.route('/account_settings', methods=['GET', 'POST'])
@login_required
def account_settings():
    db = get_db()
    if request.method == 'POST':
        action = request.form.get('action')
        
        if action == 'update':
            name = request.form.get('name')
            db.execute('UPDATE users SET name = ? WHERE id = ?',
                      [name, session['user_id']])
            db.commit()
            flash('Account details updated successfully')
            
        elif action == 'close':
            # Delete all user transactions
            db.execute('DELETE FROM transactions WHERE account_id IN (SELECT id FROM accounts WHERE user_id = ?)',
                      [session['user_id']])
            # Delete all user accounts
            db.execute('DELETE FROM accounts WHERE user_id = ?',
                      [session['user_id']])
            # Delete user record
            db.execute('DELETE FROM users WHERE id = ?',
                      [session['user_id']])
            db.commit()
            session.clear()
            flash('Your account has been permanently deleted')
            return redirect(url_for('home'))
            
        return redirect(url_for('account_settings'))
        
    user = db.execute('SELECT * FROM users WHERE id = ?',
                     [session['user_id']]).fetchone()
    return render_template('account_settings.html', user=user)

@app.route('/logout')
def logout():
    session.clear()
    return redirect(url_for('home'))


if __name__ == '__main__':
    init_db()  # Always initialize DB to ensure schema is correct
    app.run(host='0.0.0.0', port=8080, debug=True)
