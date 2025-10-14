sudo apt update
sudo apt install -y avahi-daemon avahi-utils
sudo systemctl enable --now avahi-daemon
systemctl status avahi-daemon

sudo tee /etc/avahi/services/call.service >/dev/null <<'XML'
<?xml version="1.0" standalone='no'?>
<!DOCTYPE service-group SYSTEM "avahi-service.dtd">
<service-group>
  <name replace-wildcards="yes">Call on %h</name>
  <service>
    <type>_http._tcp</type>
    <port>8080</port>
    <txt-record>path=/.well-known/call-discovery</txt-record>
  </service>
  <service>
    <type>_call._tcp</type>
    <port>8080</port>
  </service>
</service-group>
XML
sudo systemctl restart avahi-daemon


sudo nano /etc/avahi/avahi-daemon.conf  