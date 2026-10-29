import { Pool } from 'pg';

class ApplicationService {
  constructor() {
    this._pool = new Pool();
  }

  async getApplicationNotification(applicationId) {
    const query = {
      text: `
        SELECT
          applications.created_at AS application_date,
          applicant.name AS applicant_name,
          applicant.email AS applicant_email,
          jobs.title AS job_title,
          owner.email AS owner_email,
          owner.name AS owner_name
        FROM applications
        JOIN users applicant ON applicant.id = applications.user_id
        JOIN jobs ON jobs.id = applications.job_id
        JOIN companies ON companies.id = jobs.company_id
        JOIN users owner ON owner.id = companies.owner
        WHERE applications.id = $1
      `,
      values: [applicationId],
    };

    const result = await this._pool.query(query);
    return result.rows[0];
  }
}

export default ApplicationService;