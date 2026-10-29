class Listener {
  constructor(applicationService, mailSender) {
    this._applicationService = applicationService;
    this._mailSender = mailSender;
    this.listen = this.listen.bind(this);
  }

  async listen(message) {
    try {
      const { application_id: applicationId } = JSON.parse(message.content.toString());

      const data = await this._applicationService.getApplicationNotification(applicationId);

      if (!data) {
        console.error(`Data untuk application ${applicationId} tidak ditemukan`);
        return;
      }

      const result = await this._mailSender.sendEmail(data.owner_email, data);

      console.log(result);
    } catch (error) {
      console.error(error);
    }
  }
}

export default Listener;