---
title: HTTP File Server on TrueNAS - Tutorial
category: en
tags: [TrueNAS, HFS3, Tutorial]
excerpt: A Quick Guide to install and configure HFS3 on TrueNAS Scale trough a Custom App (Docker).
---

Ever wanted to share some folders from your disk with simple permissions, or even allow editing on some folders, but found NextCloud too complex for your needs? This tutorial will guide you through the installation and configuration of [HTTP File Server 3](https://rejetto.com/hfs/) on [TrueNAS Scale](https://www.truenas.com/truenas-scale/) trough a [Custom App](https://www.truenas.com/docs/truenasapps/usingcustomapp/) ([Docker](https://www.docker.com/)). Thanks to [rejetto](https://github.com/rejetto) for HFS3!

There are plenty of apps in the TrueNAS App Library, unfortunately, HFS3 is not one of them. But don't worry, we can easily install it by setting up a custom Docker app.
We'll be using open solutions, which means there is no "one good way of doing this". This is just one of many.

## Table of Contents

- [Table of Contents](#table-of-contents)
- [Prerequisites](#prerequisites)
- [Permissions and ACLs](#permissions-and-acls)
  - [Creating a Dataset for HFS](#creating-a-dataset-for-hfs)
  - [Additional Directories](#additional-directories)
- [Setting up the Custom App](#setting-up-the-custom-app)
- [Make yourself feel at home](#make-yourself-feel-at-home)
- [Comments](#comments)

*Edits and corrections: None yet.*

## Prerequisites
- A working TrueNAS Scale installation
- Knowledge of port forwarding on your router (or reverse proxy configuration)

## Permissions and ACLs

We'll start with setting up some directory permissions, so that this doesn't trip us up later.
On TrueNas Scale, Apps run under the user `apps` (id 568). We'll be granting file system permissions to this user. We'll be ***<span style="border-bottom: 1px dotted;" title="When we mount a directory in Docker, we're linking a directory from your server (the host) to a directory inside the container. A Docker container is like an isolated mini-computer. Mounting lets you share files between the host and container, ensuring that data persists and can be updated from either side. The path to the Directory inside the container will be what we'll specify.">mounting</span>*** these paths under our Custom App.

### Creating a Dataset for HFS

The most robust approach is to create a Dataset for HFS, to store the config files and logs:

1. Navigate to your Datasets (`your.server.address/ui/datasets/`)
2. Add a Dataset
  ![](/assets/hfs-truenas/image.png)
3. Enter a name, and change the Dataset Preset to `Apps`. By doing this, you gave the `apps` user Read/Write permissions to this Dataset. Finally, click Save.
  ![](/assets/hfs-truenas/image-1.png)

### Additional Directories

It's easiest to put the directories and files you want to share under the Dataset we just created.

You can of course allow HFS to see other parts of your File System. You *could* mount your whole File System, but I recommend mounting specific Datasets or Directories. Whatever you mount, you'll need to add the `apps` user to the ACL of that path. [More info on ACLs here.](https://www.truenas.com/docs/scale/scaletutorials/datasets/permissionsscale/)

## Setting up the Custom App

1. Navigate to the Apps section in the Web UI.
2. Click Dicover Apps on the top right
3. Click Custom App on the top right again
4. I recommend the following configuration options:
<br><br>
    - Application Name: `hfs`\
    You can enter any lowecase name.
    - Version: *leave as-is*\
    This is the version of your own Custom App - it doesn't matter.
<br><br>
    **Image Configuration**
    - Repository: `rejetto/hfs`
    - Tag: `latest`
    - Pull Policy: `Always pull an image even if it is present on the host.`\
    This will always download the latest stable version of HFS from the Docker Hub. **Important:** Never update HFS from the Admin Panel of HFS, instead, restart your Custom App and let it download the latest image from Docker Hub.
<br><br>
    **Container Configuration**
    - Hostname: *leave empty*
    - Entrypoint: *leave empty*
    - Command: *leave empty*
    - Timezone: set yours
    - Environment Variables:\
    Add the following variables:
      - Name: `HFS_CREATE_ADMIN`; Value: `password123`\
      This will create a user `admin` with the specified password. If you use a simple password here, remember to change it! You can remove this variable after you started the App once.
      - **Advanced:** Name: `HFS_PORT`; Value: *decide yourself*\
      You don't need to specify this, unless you want HFS to use a different port than 80/443. This will be the port HFS uses inside the container.
    - Restart Policy: `Unless Stopped`\
    This will make sure your HFS always starts and stays running.\
    You can leave the rest of Container Configuration empty.
<br><br>
    **Security Context Configuration**\
    You can leave this section empty. If you want to use another user for HFS instead of `apps`, you can create one in the Credentials page and add its User and/or Group IDs here. Remember to set the ACLs accordingly if you do this.
<br><br>
    **Network Configuration**
    - Host Network: *leave OFF*
    - Ports:\
    Add new ports with parameters:
      - **HTTP**
        - Container port: `80`\
        Make sure it's the same as `HFS_PORT`, if you defined it.
        - Host port: `80`\
        This is the port you'll be able to access HFS from your local network, and from anywhere if you port-forward. For maximum safety, I recommend setting up a simple reverse-proxy like [Nginx Proxy Manager](https://nginxproxymanager.com/) (available as a TrueNas App), and letting it handle your HTTPS traffic. In this case, use a high port, like `30100`, and set up the reverse-proxy for it. I will not cover this usecase here in detail.
        - Protocol: `TCP`
      - **HTTPS**\
      If you're not using a reverse-proxy, and you'll request a certificate through HFS, you need to expose the HTTPS port as well.
        - Container port: `443`
        - Host port: `443`
        - Protocol: `TCP`
    - Rest of Network Configuration: leave empty.
    - Portal Configuration: leave empty.
<br><br>
    **Storage Configuration**
    - Add a Storage option for your HFS Config Dataset:
      - Type: `Host Path`
      - Mount Path (**important!**): `/.hfs`
      - Enable ACL: *leave OFF*
      - Host Path: select path to the Dataset you created earlier, for example: `/mnt/MY-SERVER/HFS`
    - Add a Storage options for other shared Datasets:
      - Type: `Host Path`
      - Mount Path (**important!**): `/mnt/[folder-name]`\
      You find your folders in the HFS Web Panel in this place, too (under the `mnt` folder in the root of the container's file system.)
      - Host Path: path to your Dataset or Directory.
<br><br>
    - Labels Configuration: leave empty.
<br><br>
    **Resources Configuration**\
    HFS won't use much when idle, but be sure to give ample resources to handle big tasks, like zipping or listing many files.
    You won't need GPU Passtrough, leave it OFF.

And that's about it, click Install!

## Make yourself feel at home

After you first started HFS, it will populate `/.hfs` with its config files.

If you had a previous HFS config: find your `config.yaml` file, and open it up in a text editor. Replace all `source` entries in your `vfs` section according to how you mounted directories just now under `/mnt/`. Stop the HFS Custom App, and replace the original `config.yaml` with yours (for example, trough an SMB share).

You can set up a reverse-proxy or even Cloudflare for your server - these will not be covered here today. If you use a proxy, don't forget to set the Number of HTTP Proxies under Options/Networking on the HFS Admin Panel.

Happy sharing!

## Comments

Feel free to ask questions or share your insights here. Keep it civil \;)