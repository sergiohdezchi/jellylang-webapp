class AddEmailVerificationToUsers < ActiveRecord::Migration[8.1]
  def change
    add_column :users, :email_verified_at, :datetime
    add_column :users, :verification_code_digest, :string
    add_column :users, :verification_code_sent_at, :datetime
    add_column :users, :verification_attempts, :integer, null: false, default: 0

    # Las cuentas que ya existen se dan por verificadas
    reversible do |dir|
      dir.up { execute "UPDATE users SET email_verified_at = created_at" }
    end
  end
end
